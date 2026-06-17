import { deriveKeys, deriveMasterKey, deriveEncryptionKey, deriveLoginHash } from './derive'
import { generateSalt, deriveKey, DEFAULT_KDF_CONFIG } from './argon2'
import {
  encrypt,
  decrypt,
  stringToBytes,
  bytesToString,
  base64Encode,
  base64Decode,
} from './aes'
import { generateRecoveryCode } from './recovery'
import type { EncryptedVault, VaultData, KdfConfig } from './types'

/**
 * 信封加密模块（双密钥派生版，对标 Bitwarden / Vaultwarden）
 *
 * 核心流程：
 *   - 登录密码 + 用户名 → 主密钥（Argon2id）→ 加密密钥（HKDF）+ 登录哈希（HKDF）
 *   - 随机 DEK 加密整个 vault；DEK 被两把锁分别包裹：
 *       · 加密密钥（登录密码派生）→ wrappedKeys.password
 *       · 恢复码派生密钥           → wrappedKeys.recovery
 *   - 后端只拿到登录哈希，无法反推加密密钥 → 无法解密 vault
 */

/**
 * 生成随机 DEK（数据加密密钥）
 *
 * @returns 32 字节随机密钥
 */
function generateDEK(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

/**
 * 创建新保险库
 *
 * 用「登录密码派生的加密密钥」和「恢复码派生密钥」双重包裹 DEK，加密初始空保险库。
 *
 * @param username - 用户名（作为派生 salt，明文存储）
 * @param password - 登录密码
 * @param kdfConfig - KDF 配置（可选，默认 64MiB / 3轮 / 并行度1）
 * @returns 加密保险库 + 恢复码 + 加密密钥 + 登录哈希
 *          （⚠️ 恢复码仅此处返回一次；加密密钥用于会话内加解密，登录哈希用于后端鉴权）
 */
export async function createVault(
  username: string,
  password: string,
  kdfConfig: KdfConfig = DEFAULT_KDF_CONFIG
): Promise<{
  vault: EncryptedVault
  recoveryCode: string
  encryptionKey: Uint8Array
  loginHash: string
}> {
  if (!username) {
    throw new Error('用户名不能为空')
  }
  if (!password || password.length < 8) {
    throw new Error('登录密码至少 8 个字符')
  }

  // 1. 派生加密密钥与登录哈希（一次 Argon2id + 两次 HKDF）
  const { encryptionKey, loginHash } = await deriveKeys(password, username, kdfConfig)

  // 2. 生成 DEK（数据加密密钥）
  const dek = generateDEK()

  // 3. 生成恢复码
  const recoveryCode = generateRecoveryCode()

  // 4. 用加密密钥包裹 DEK（无需独立 salt，加密密钥已由用户名派生）
  const wrappedByPassword = await encrypt(dek, encryptionKey)

  // 5. 用恢复码派生密钥包裹 DEK（恢复码本身高熵，用独立随机 salt）
  const recoverySalt = generateSalt()
  const recoveryKey = await deriveKey(recoveryCode, recoverySalt, kdfConfig)
  const wrappedByRecovery = await encrypt(dek, recoveryKey)

  // 6. 加密初始保险库数据（空账户列表）
  const initialVaultData: VaultData = { accounts: [] }
  const vaultBytes = stringToBytes(JSON.stringify(initialVaultData))
  const encryptedVault = await encrypt(vaultBytes, dek)

  // 7. 组装加密保险库（v2 格式）
  const vault: EncryptedVault = {
    version: 2,
    username,
    kdf: kdfConfig,
    loginHash,
    wrappedKeys: {
      password: {
        nonce: base64Encode(wrappedByPassword.nonce),
        ct: base64Encode(wrappedByPassword.ciphertext),
      },
      recovery: {
        salt: base64Encode(recoverySalt),
        nonce: base64Encode(wrappedByRecovery.nonce),
        ct: base64Encode(wrappedByRecovery.ciphertext),
      },
    },
    vault: {
      nonce: base64Encode(encryptedVault.nonce),
      ct: base64Encode(encryptedVault.ciphertext),
    },
    updatedAt: new Date().toISOString(),
  }

  return { vault, recoveryCode, encryptionKey, loginHash }
}

/**
 * 用「已派生的加密密钥」解锁保险库（不需要密码，不跑 Argon2id）
 *
 * 适用于会话内已持有 encryptionKey 的场景（如同步时解密远程 vault、刷新数据），
 * 避免重复执行昂贵的 Argon2id 派生。
 *
 * @param vault - 加密的保险库
 * @param encryptionKey - 会话内的加密密钥
 * @returns 解密后的保险库数据
 * @throws 如果密钥错误或数据被篡改
 */
export async function unlockWithEncryptionKey(
  vault: EncryptedVault,
  encryptionKey: Uint8Array
): Promise<VaultData> {
  // 1. 用加密密钥解开 DEK
  const wrappedKey = vault.wrappedKeys.password
  const dek = await decrypt(
    base64Decode(wrappedKey.nonce),
    base64Decode(wrappedKey.ct),
    encryptionKey
  )

  // 2. 用 DEK 解密保险库数据
  return decryptVaultData(vault, dek)
}

/**
 * 用登录密码解锁保险库
 *
 * 跑一次 Argon2id 派生出加密密钥与登录哈希，再用加密密钥解密。
 *
 * @param vault - 加密的保险库
 * @param password - 登录密码
 * @returns 解密后的数据 + 加密密钥 + 登录哈希（供会话内加解密与后端鉴权复用）
 * @throws 如果密码错误或数据被篡改
 */
export async function unlockWithPassword(
  vault: EncryptedVault,
  password: string
): Promise<{ data: VaultData; encryptionKey: Uint8Array; loginHash: string }> {
  // 1. 用「保险库里记录的用户名 + 登录密码」派生主密钥，再分流出加密密钥与登录哈希
  const masterKey = await deriveMasterKey(password, vault.username, vault.kdf)
  const encryptionKey = await deriveEncryptionKey(masterKey)
  const loginHash = await deriveLoginHash(masterKey)

  // 2. 用加密密钥解密
  const data = await unlockWithEncryptionKey(vault, encryptionKey)

  return { data, encryptionKey, loginHash }
}

/**
 * 用恢复码解锁保险库
 *
 * @param vault - 加密的保险库
 * @param recoveryCode - 恢复码
 * @returns 解密后的数据 + DEK（恢复码解锁后可用 DEK 重设登录密码）
 * @throws 如果恢复码错误或数据被篡改
 */
export async function unlockWithRecoveryCode(
  vault: EncryptedVault,
  recoveryCode: string
): Promise<{ data: VaultData; dek: Uint8Array }> {
  const wrappedKey = vault.wrappedKeys.recovery

  // 1. 用恢复码派生密钥（恢复码分支必有独立 salt）
  if (!wrappedKey.salt) {
    throw new Error('恢复码数据损坏：缺少 salt')
  }
  const salt = base64Decode(wrappedKey.salt)
  const key = await deriveKey(recoveryCode, salt, vault.kdf)

  // 2. 解开 DEK
  const dek = await decrypt(
    base64Decode(wrappedKey.nonce),
    base64Decode(wrappedKey.ct),
    key
  )

  // 3. 用 DEK 解密保险库数据
  const data = await decryptVaultData(vault, dek)

  return { data, dek }
}

/**
 * 用 DEK 解密保险库数据
 *
 * @param vault - 加密的保险库
 * @param dek - 数据加密密钥
 * @returns 解密后的保险库数据
 */
async function decryptVaultData(
  vault: EncryptedVault,
  dek: Uint8Array
): Promise<VaultData> {
  const vaultBytes = await decrypt(
    base64Decode(vault.vault.nonce),
    base64Decode(vault.vault.ct),
    dek
  )
  return JSON.parse(bytesToString(vaultBytes)) as VaultData
}

/**
 * 保存保险库数据（用加密密钥解开 DEK，再用 DEK 重新加密新数据）
 *
 * @param vault - 当前加密的保险库
 * @param encryptionKey - 会话内的加密密钥（解锁时已派生，避免重复跑 Argon2id）
 * @param newVaultData - 新的保险库数据
 * @returns 更新后的加密保险库
 */
export async function saveVaultData(
  vault: EncryptedVault,
  encryptionKey: Uint8Array,
  newVaultData: VaultData
): Promise<EncryptedVault> {
  // 1. 用加密密钥解开 DEK
  const wrappedKey = vault.wrappedKeys.password
  const dek = await decrypt(
    base64Decode(wrappedKey.nonce),
    base64Decode(wrappedKey.ct),
    encryptionKey
  )

  // 2. 用 DEK 加密新数据
  const vaultBytes = stringToBytes(JSON.stringify(newVaultData))
  const encryptedVault = await encrypt(vaultBytes, dek)

  // 3. 更新保险库（vault 密文更新，其余不变）
  return {
    ...vault,
    vault: {
      nonce: base64Encode(encryptedVault.nonce),
      ct: base64Encode(encryptedVault.ciphertext),
    },
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 更改登录密码
 *
 * 用新「用户名+登录密码」重新派生加密密钥，重新包裹 DEK，并更新登录哈希。
 * 不需要重新加密整个 vault 数据。
 *
 * @param vault - 当前加密的保险库
 * @param oldPassword - 旧登录密码
 * @param newPassword - 新登录密码
 * @returns 更新后的加密保险库 + 新加密密钥 + 新登录哈希
 */
export async function changePassword(
  vault: EncryptedVault,
  oldPassword: string,
  newPassword: string
): Promise<{ vault: EncryptedVault; encryptionKey: Uint8Array; loginHash: string }> {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('新登录密码至少 8 个字符')
  }

  // 1. 用旧密码解开 DEK
  const oldEncryptionKey = await deriveEncryptionKey(
    await deriveMasterKey(oldPassword, vault.username, vault.kdf)
  )
  const wrappedKey = vault.wrappedKeys.password
  const dek = await decrypt(
    base64Decode(wrappedKey.nonce),
    base64Decode(wrappedKey.ct),
    oldEncryptionKey
  )

  // 2. 用新密码派生新的加密密钥和登录哈希（用户名不变）
  const masterKey = await deriveMasterKey(newPassword, vault.username, vault.kdf)
  const encryptionKey = await deriveEncryptionKey(masterKey)
  const loginHash = await deriveLoginHash(masterKey)

  // 3. 用新加密密钥重新包裹 DEK
  const wrappedByNewPassword = await encrypt(dek, encryptionKey)

  // 4. 更新保险库（只改 password 包裹和 loginHash，vault 数据不变）
  const updatedVault: EncryptedVault = {
    ...vault,
    loginHash,
    wrappedKeys: {
      ...vault.wrappedKeys,
      password: {
        nonce: base64Encode(wrappedByNewPassword.nonce),
        ct: base64Encode(wrappedByNewPassword.ciphertext),
      },
    },
    updatedAt: new Date().toISOString(),
  }

  return { vault: updatedVault, encryptionKey, loginHash }
}
