import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { EncryptedVault, VaultData } from '@/crypto/types'
import type { Account } from '@/totp/types'
import {
  createVault,
  unlockWithPassword,
  unlockWithEncryptionKey,
  unlockWithRecoveryCode,
  saveVaultData,
  deriveKeys,
  DEFAULT_KDF_CONFIG,
  encrypt,
} from '@/crypto'
import { base64Encode, base64Decode } from '@/crypto'
import { loadVault, saveVault, deleteVault, getCachedUsername, setCachedUsername, clearCachedUsername } from '@/storage'
import {
  saveSessionSnapshot,
  takeSessionSnapshot,
  clearSessionSnapshot,
} from '@/storage/session'
import { pullVault, pushVault, fetchVaultExists, mergeVaultData } from '@/sync'
import type { SyncStatus } from '@/sync/types'

/**
 * Vault 状态管理（双密钥派生 + 三态：登录/锁定/退出）
 *
 * 三态说明：
 *   - 登录中：isUnlocked=true，内存有 encryptionKey/loginHash/username
 *   - 锁定：isUnlocked=false，缓存有 username，内存清空，本地 vault 保留
 *   - 退出：isUnlocked=false，缓存清空，内存清空，本地 vault 清空
 */

interface VaultContextType {
  // 状态
  isUnlocked: boolean
  hasVault: boolean
  accounts: Account[]
  isLoading: boolean
  syncStatus: SyncStatus
  username: string | null // 当前登录的用户名（锁定时为 null，但缓存里还有）

  // 保险库操作
  createNewVault: (username: string, password: string) => Promise<{ recoveryCode: string; completeSetup: () => void }>
  login: (username: string, password: string) => Promise<void> // 新浏览器/退出后重新登录
  unlock: (password: string) => Promise<void> // 锁定后解锁（用户名从缓存读）
  resetPasswordWithRecovery: (recoveryCode: string, newPassword: string) => Promise<void>
  lock: () => void // 锁定（清内存，保留缓存+本地vault）
  logout: () => void // 退出（全清）

  // 账户操作
  addAccount: (account: Account) => Promise<void>
  addAccountsBatch: (accounts: Account[]) => Promise<void>
  updateAccount: (accountId: string, updates: Partial<Account>) => Promise<void>
  deleteAccount: (accountId: string) => Promise<void>

  // 同步操作
  sync: () => Promise<void>
  refreshVault: () => Promise<void>
}

const VaultContext = createContext<VaultContextType | undefined>(undefined)

interface VaultProviderProps {
  children: ReactNode
}

export function VaultProvider({ children }: VaultProviderProps) {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [hasVault, setHasVault] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 会话内保存的敏感数据（锁定时清空）
  const [username, setUsername] = useState<string | null>(null)
  const [encryptionKey, setEncryptionKey] = useState<Uint8Array | null>(null)
  const [loginHash, setLoginHash] = useState<string | null>(null)
  const [encryptedVault, setEncryptedVault] = useState<EncryptedVault | null>(null)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncAt: null,
    lastVersion: null,
    isSyncing: false,
    error: null,
  })

  /**
   * 初始化：检查后端是否有 vault，判断 hasVault；尝试从 sessionStorage 恢复会话
   */
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        // 0. 检查是否有待确认的恢复码（刷新后自动设置 hasVault）
        const pending = localStorage.getItem('vault_pending_recovery')
        if (pending) {
          // 有待确认的恢复码，说明已创建保险库
          setHasVault(true)
          setIsLoading(false)
          return // 跳转到 UnlockPage，由 UnlockPage 显示恢复码弹窗
        }

        // 1. 尝试从 sessionStorage 恢复会话（刷新后无感恢复）
        const snapshot = takeSessionSnapshot() // 读取后立即清除
        if (snapshot) {
          try {
            const localVault = await loadVault()
            if (localVault) {
              const kek = base64Decode(snapshot.encryptionKey)
              const data = await unlockWithEncryptionKey(localVault, kek)

              // 恢复成功，设置状态
              setUsername(snapshot.username)
              setEncryptionKey(kek)
              setLoginHash(snapshot.loginHash)
              setEncryptedVault(localVault)
              setAccounts(data.accounts)
              setIsUnlocked(true)
              setHasVault(true)
              setIsLoading(false)
              return // 恢复成功，无需继续初始化
            }
          } catch (error) {
            console.warn('会话恢复失败:', error)
            // 恢复失败，继续正常初始化流程
          }
        }

        // 2. 正常初始化：检查 vault 是否存在
        // 调用公开接口 /api/vault/exists（单用户模式，不需要 username）
        const result = await fetchVaultExists()

        if (result) {
          setHasVault(result.exists)
        } else {
          // 后端不可达，回退到本地缓存判断
          const localVault = await loadVault()
          setHasVault(localVault !== null)
        }
      } catch (error) {
        console.error('初始化失败:', error)
        setHasVault(false)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  /**
   * 创建新保险库
   * 1. 派生加密密钥 + 登录哈希
   * 2. 创建加密 vault
   * 3. 推送到后端
   * 4. 缓存到本地
   * 5. 缓存用户名
   */
  const createNewVault = useCallback(async (username: string, password: string) => {
    const result = await createVault(username, password)

    // 推送到后端
    try {
      await pushVault(result.vault, result.loginHash, null)
      setSyncStatus({
        lastSyncAt: new Date().toISOString(),
        lastVersion: null,
        isSyncing: false,
        error: null,
      })
    } catch (error) {
      console.warn('初次同步失败（将在后续自动重试）:', error)
    }

    // 缓存到本地
    await saveVault(result.vault)

    // 缓存用户名
    setCachedUsername(username)

    // 暂时保存状态，等用户确认恢复码后再设置 isUnlocked 和 hasVault
    const tempState = {
      username,
      encryptionKey: result.encryptionKey,
      loginHash: result.loginHash,
      vault: result.vault,
    }

    // 返回恢复码 + 完成设置的函数
    return {
      recoveryCode: result.recoveryCode,
      completeSetup: () => {
        setUsername(tempState.username)
        setEncryptionKey(tempState.encryptionKey)
        setLoginHash(tempState.loginHash)
        setEncryptedVault(tempState.vault)
        setAccounts([])
        setIsUnlocked(true)
        setHasVault(true)
      },
    }
  }, [])

  /**
   * 登录（新浏览器 / 退出后重新登录，需要输入用户名+密码）
   *
   * 流程：
   * 1. 用用户名+密码派生加密密钥+登录哈希（Argon2id 用默认配置）
   * 2. 用 loginHash 从后端拉取 vault
   * 3. 后端不可达时用本地缓存
   * 4. 用 encryptionKey 解密 vault
   * 5. 缓存用户名
   */
  const login = useCallback(async (username: string, password: string) => {
    // 1. 派生加密密钥 + 登录哈希（用默认 KDF 配置）
    const { encryptionKey: derivedEncKey, loginHash: derivedLoginHash } = await deriveKeys(
      password,
      username,
      DEFAULT_KDF_CONFIG
    )

    let vault: EncryptedVault | null = null
    let vaultVersion: string | null = null

    // 2. 尝试从后端拉取（用 loginHash 鉴权）
    try {
      const remote = await pullVault(derivedLoginHash)
      if (remote) {
        vault = remote.vault
        vaultVersion = remote.version
        // 更新本地缓存
        await saveVault(vault)
        setSyncStatus({
          lastSyncAt: new Date().toISOString(),
          lastVersion: vaultVersion,
          isSyncing: false,
          error: null,
        })
      }
    } catch (error) {
      console.warn('从后端拉取失败，尝试使用本地缓存:', error)
    }

    // 3. 后端没有或拉取失败，使用本地缓存
    if (!vault) {
      vault = await loadVault()
      if (!vault) {
        throw new Error('未找到保险库数据')
      }
      // 验证用户名是否匹配
      if (vault.username !== username) {
        throw new Error('用户名不匹配')
      }
    }

    // 4. 用 encryptionKey 解密
    const data = await unlockWithEncryptionKey(vault, derivedEncKey)

    // 5. 缓存用户名
    setCachedUsername(username)

    // 更新状态
    setUsername(username)
    setEncryptionKey(derivedEncKey)
    setLoginHash(derivedLoginHash)
    setEncryptedVault(vault)
    setAccounts(data.accounts)
    setIsUnlocked(true)
  }, [])

  /**
   * 解锁（锁定态解锁，用户名从缓存读，只需输入密码）
   *
   * 流程：
   * 1. 读缓存用户名
   * 2. 本地验证密码（快速失败，一次 Argon2id）
   * 3. 有网则从后端拉取最新 → 合并 → 解密
   * 4. 无网则用本地缓存解密
   */
  const unlock = useCallback(async (password: string) => {
    // 1. 读缓存用户名
    const cachedUser = getCachedUsername()
    if (!cachedUser) {
      throw new Error('未找到缓存用户名，请重新登录')
    }

    // 2. 先用本地 vault 验证密码（快速失败）
    let localVault = await loadVault()
    if (!localVault) {
      throw new Error('未找到本地保险库数据')
    }

    // 解密本地 vault（验证密码，同时派生出 encryptionKey 和 loginHash）
    const { data: localData, encryptionKey: derivedEncKey, loginHash: derivedLoginHash } = await unlockWithPassword(localVault, password)

    // 3. 有网则尝试拉取最新
    try {
      const remote = await pullVault(derivedLoginHash)
      if (remote) {
        const remoteData = await unlockWithEncryptionKey(remote.vault, derivedEncKey)
        // 合并
        const merged = mergeVaultData(localData, remoteData)
        // 保存合并后的数据
        const mergedVault = await saveVaultData(remote.vault, derivedEncKey, merged)
        await saveVault(mergedVault)

        // 更新状态
        setUsername(cachedUser)
        setEncryptionKey(derivedEncKey)
        setLoginHash(derivedLoginHash)
        setEncryptedVault(mergedVault)
        setAccounts(merged.accounts)
        setIsUnlocked(true)
        setSyncStatus({
          lastSyncAt: new Date().toISOString(),
          lastVersion: remote.version,
          isSyncing: false,
          error: null,
        })
        return
      }
    } catch (error) {
      console.warn('解锁时拉取后端失败，使用本地缓存:', error)
    }

    // 4. 无网或后端拉取失败，使用本地数据
    setUsername(cachedUser)
    setEncryptionKey(derivedEncKey)
    setLoginHash(derivedLoginHash)
    setEncryptedVault(localVault)
    setAccounts(localData.accounts)
    setIsUnlocked(true)
  }, [])

  /**
   * 用恢复码解锁（只能用本地缓存，无法同步）
   */
  /**
   * 用恢复码解锁（临时方案，后续会移除）
   *
   * @deprecated 请使用 resetPasswordWithRecovery 重置密码
   */
  /**
   * 用恢复码重置密码
   *
   * 流程：
   * 1. 用恢复码解密 DEK
   * 2. 用新密码派生新的加密密钥和登录哈希
   * 3. 用新的加密密钥重新包裹 DEK
   * 4. 更新 vault 并推送到后端
   * 5. 登录成功
   *
   * @param recoveryCode - 恢复码
   * @param newPassword - 新的登录密码
   */
  const resetPasswordWithRecovery = useCallback(async (recoveryCode: string, newPassword: string) => {
    // 1. 加载本地 vault
    const vault = await loadVault()
    if (!vault) {
      throw new Error('未找到本地保险库数据')
    }

    // 2. 用恢复码解密 DEK
    const { dek } = await unlockWithRecoveryCode(vault, recoveryCode)

    // 3. 用新密码派生新的密钥对
    const { encryptionKey: newEncKey, loginHash: newLoginHash } = await deriveKeys(
      newPassword,
      vault.username,
      vault.kdf
    )

    // 4. 用新的加密密钥重新包裹 DEK
    const wrappedByPassword = await encrypt(dek, newEncKey)

    // 5. 更新 vault 的 wrappedKeys.password
    const updatedVault: EncryptedVault = {
      ...vault,
      loginHash: newLoginHash,
      wrappedKeys: {
        ...vault.wrappedKeys,
        password: {
          nonce: base64Encode(wrappedByPassword.nonce),
          ct: base64Encode(wrappedByPassword.ciphertext),
        },
      },
      updatedAt: new Date().toISOString(),
    }

    // 6. 推送到后端（用新的 loginHash）
    try {
      await pushVault(updatedVault, newLoginHash, null)
    } catch (error) {
      console.warn('重置密码后同步失败（将在后续自动重试）:', error)
    }

    // 7. 保存到本地
    await saveVault(updatedVault)

    // 8. 重置成功，不自动登录，让用户跳转到 unlock 页面重新输入新密码
    // 只更新同步状态
    setSyncStatus({
      lastSyncAt: new Date().toISOString(),
      lastVersion: null,
      isSyncing: false,
      error: null,
    })
  }, [])

  /**
   * 锁定（清内存敏感数据，保留用户名缓存 + 本地 vault）
   */
  const lock = useCallback(() => {
    clearSessionSnapshot() // 清会话密钥
    setIsUnlocked(false)
    setUsername(null)
    setEncryptionKey(null)
    setLoginHash(null)
    setEncryptedVault(null)
    setAccounts([])
    // 用户名缓存保留在 localStorage
    // 本地 vault 保留在 IndexedDB
  }, [])

  /**
   * 退出（清内存 + 清用户名缓存 + 清本地 vault，后端不动）
   */
  const logout = useCallback(async () => {
    clearSessionSnapshot() // 清会话密钥
    setIsUnlocked(false)
    setUsername(null)
    setEncryptionKey(null)
    setLoginHash(null)
    setEncryptedVault(null)
    setAccounts([])
    setSyncStatus({
      lastSyncAt: null,
      lastVersion: null,
      isSyncing: false,
      error: null,
    })

    // 清缓存和本地 vault
    clearCachedUsername()
    await deleteVault()
  }, [])

  /**
   * 保存当前账户数据到保险库
   * 策略：
   * 1. 用会话内的 encryptionKey 加密数据
   * 2. 立即推送到后端
   * 3. 更新本地缓存
   */
  const saveCurrentVault = useCallback(
    async (newAccounts: Account[]) => {
      if (!encryptedVault || !encryptionKey || !loginHash) {
        throw new Error('无法保存：未解锁或缺少会话密钥')
      }

      const newVaultData: VaultData = { accounts: newAccounts }
      const updatedVault = await saveVaultData(encryptedVault, encryptionKey, newVaultData)

      // 立即推送到后端
      try {
        // 如果没有 lastVersion（刷新后丢失），先拉取获取当前版本
        let expectedVersion = syncStatus.lastVersion
        if (!expectedVersion) {
          console.log('[saveCurrentVault] 无 lastVersion，先拉取获取版本')
          try {
            const remote = await pullVault(loginHash)
            expectedVersion = remote?.version || null
            console.log('[saveCurrentVault] 获取到版本:', expectedVersion)
          } catch (error) {
            console.warn('[saveCurrentVault] 拉取版本失败，使用 null:', error)
          }
        }

        const newVersion = await pushVault(updatedVault, loginHash, expectedVersion)
        setSyncStatus(prev => ({
          ...prev,
          lastSyncAt: new Date().toISOString(),
          lastVersion: newVersion,
          error: null,
        }))
      } catch (error) {
        console.warn('自动同步失败:', error)
        setSyncStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : '同步失败',
        }))
      }

      // 更新本地缓存
      await saveVault(updatedVault)

      setEncryptedVault(updatedVault)
      setAccounts(newAccounts)
    },
    [encryptedVault, encryptionKey, loginHash, syncStatus.lastVersion]
  )

  const addAccount = useCallback(
    async (account: Account) => {
      const newAccounts = [...accounts, account]
      await saveCurrentVault(newAccounts)
    },
    [accounts, saveCurrentVault]
  )

  const addAccountsBatch = useCallback(
    async (newAccounts: Account[]) => {
      const mergedAccounts = [...accounts, ...newAccounts]
      await saveCurrentVault(mergedAccounts)
    },
    [accounts, saveCurrentVault]
  )

  const updateAccount = useCallback(
    async (accountId: string, updates: Partial<Account>) => {
      const newAccounts = accounts.map((acc) =>
        acc.id === accountId ? { ...acc, ...updates, updatedAt: new Date().toISOString() } : acc
      )
      await saveCurrentVault(newAccounts)
    },
    [accounts, saveCurrentVault]
  )

  const deleteAccount = useCallback(
    async (accountId: string) => {
      const newAccounts = accounts.map((acc) =>
        acc.id === accountId
          ? { ...acc, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : acc
      )
      await saveCurrentVault(newAccounts)
    },
    [accounts, saveCurrentVault]
  )

  /**
   * 手动同步
   */
  const sync = useCallback(async () => {
    if (!encryptedVault || !encryptionKey || !loginHash) {
      throw new Error('无法同步：未解锁')
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }))

    try {
      // 1. 拉取远程数据
      const remote = await pullVault(loginHash)

      if (remote) {
        // 2. 解密本地和远程数据
        const localData: VaultData = { accounts }
        const remoteData = await unlockWithEncryptionKey(remote.vault, encryptionKey)

        // 3. 智能合并
        const mergedData = mergeVaultData(localData, remoteData)

        // 4. 保存合并后的数据
        const mergedVault = await saveVaultData(encryptedVault, encryptionKey, mergedData)

        // 5. 推送到远程
        const newVersion = await pushVault(mergedVault, loginHash, remote.version)

        // 6. 更新本地缓存
        await saveVault(mergedVault)

        // 7. 更新状态
        setEncryptedVault(mergedVault)
        setAccounts(mergedData.accounts)
        setSyncStatus({
          lastSyncAt: new Date().toISOString(),
          lastVersion: newVersion,
          isSyncing: false,
          error: null,
        })
      } else {
        // 远程没有数据，直接推送本地数据
        const newVersion = await pushVault(encryptedVault, loginHash, null)
        setSyncStatus({
          lastSyncAt: new Date().toISOString(),
          lastVersion: newVersion,
          isSyncing: false,
          error: null,
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '同步失败'
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: errorMsg,
      }))
      throw error
    }
  }, [encryptedVault, encryptionKey, loginHash, accounts])

  /**
   * 刷新保险库（从后端重新加载）
   */
  const refreshVault = useCallback(async () => {
    if (!loginHash || !encryptionKey) {
      throw new Error('无法刷新：缺少会话密钥')
    }

    try {
      const remote = await pullVault(loginHash)
      if (remote) {
        const data = await unlockWithEncryptionKey(remote.vault, encryptionKey)
        await saveVault(remote.vault)
        setEncryptedVault(remote.vault)
        setAccounts(data.accounts)
      }
    } catch (error) {
      console.error('刷新失败:', error)
      throw error
    }
  }, [loginHash, encryptionKey])

  // 解锁状态下，刷新前将内存密钥临时存入 sessionStorage（支持无感恢复）
  useEffect(() => {
    if (!isUnlocked || !username || !encryptionKey || !loginHash) return

    const handleBeforeUnload = () => {
      // 刷新前存密钥（几秒后恢复时立即清除）
      saveSessionSnapshot({
        username,
        encryptionKey: base64Encode(encryptionKey),
        loginHash,
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isUnlocked, username, encryptionKey, loginHash])

  const value: VaultContextType = {
    isUnlocked,
    hasVault,
    accounts,
    isLoading,
    syncStatus,
    username,
    createNewVault,
    login,
    unlock,
    resetPasswordWithRecovery,
    lock,
    logout,
    addAccount,
    addAccountsBatch,
    updateAccount,
    deleteAccount,
    sync,
    refreshVault,
  }

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export function useVault() {
  const context = useContext(VaultContext)
  if (!context) {
    throw new Error('useVault must be used within VaultProvider')
  }
  return context
}
