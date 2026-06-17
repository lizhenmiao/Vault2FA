import { describe, it, expect } from 'vitest'
import {
  createVault,
  unlockWithPassword,
  unlockWithRecoveryCode,
  saveVaultData,
  changePassword,
} from '../envelope'
import type { VaultData } from '../types'

// 测试统一使用的用户名
const USERNAME = 'testuser'

describe('信封加密 - 创建保险库', () => {
  it('应该成功创建保险库并返回恢复码、加密密钥、登录哈希', async () => {
    const password = 'test-password-123'
    const { vault, recoveryCode, encryptionKey, loginHash } = await createVault(
      USERNAME,
      password
    )

    expect(vault).toBeDefined()
    expect(vault.version).toBe(2)
    expect(vault.username).toBe(USERNAME)
    expect(vault.loginHash).toBe(loginHash)
    expect(vault.wrappedKeys.password).toBeDefined()
    expect(vault.wrappedKeys.recovery).toBeDefined()
    expect(vault.vault).toBeDefined()
    expect(recoveryCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-/)
    expect(encryptionKey).toBeInstanceOf(Uint8Array)
    expect(encryptionKey.length).toBe(32)
    expect(typeof loginHash).toBe('string')
  })

  it('用户名为空应该抛出错误', async () => {
    await expect(createVault('', 'test-password-123')).rejects.toThrow(
      '用户名不能为空'
    )
  })

  it('密码少于 8 个字符应该抛出错误', async () => {
    await expect(createVault(USERNAME, 'short')).rejects.toThrow(
      '登录密码至少 8 个字符'
    )
  })

  it('新建保险库应该包含空账户列表', async () => {
    const password = 'test-password-123'
    const { vault } = await createVault(USERNAME, password)
    const { data } = await unlockWithPassword(vault, password)

    expect(data.accounts).toEqual([])
  })
})

describe('信封加密 - 用登录密码解锁', () => {
  it('应该用正确的登录密码解锁保险库', async () => {
    const password = 'test-password-123'
    const { vault } = await createVault(USERNAME, password)
    const { data, encryptionKey, loginHash } = await unlockWithPassword(
      vault,
      password
    )

    expect(data.accounts).toEqual([])
    expect(encryptionKey).toBeInstanceOf(Uint8Array)
    // 解锁派生出的登录哈希应与保险库中存储的一致
    expect(loginHash).toBe(vault.loginHash)
  })

  it('错误的登录密码应该解锁失败', async () => {
    const password = 'test-password-123'
    const { vault } = await createVault(USERNAME, password)

    await expect(
      unlockWithPassword(vault, 'wrong-password')
    ).rejects.toThrow('解密失败')
  })
})

describe('信封加密 - 用恢复码解锁', () => {
  it('应该用恢复码解锁保险库', async () => {
    const password = 'test-password-123'
    const { vault, recoveryCode } = await createVault(USERNAME, password)
    const { data } = await unlockWithRecoveryCode(vault, recoveryCode)

    expect(data.accounts).toEqual([])
  })

  it('错误的恢复码应该解锁失败', async () => {
    const password = 'test-password-123'
    const { vault } = await createVault(USERNAME, password)

    await expect(
      unlockWithRecoveryCode(vault, 'AAAA-BBBB-CCCC-DDDD')
    ).rejects.toThrow('解密失败')
  })

  it('登录密码和恢复码应该解锁到相同数据', async () => {
    const password = 'test-password-123'
    const { vault, recoveryCode } = await createVault(USERNAME, password)

    const byPassword = await unlockWithPassword(vault, password)
    const byRecovery = await unlockWithRecoveryCode(vault, recoveryCode)

    expect(byPassword.data).toEqual(byRecovery.data)
  })
})

describe('信封加密 - 保存数据', () => {
  it('应该保存并正确读取新数据', async () => {
    const password = 'test-password-123'
    const { vault, encryptionKey } = await createVault(USERNAME, password)

    // 添加一个模拟账户
    const newData: VaultData = {
      accounts: [
        {
          id: '1',
          issuer: 'GitHub',
          label: 'user@example.com',
          secret: 'JBSWY3DPEHPK3PXP',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          type: 'totp',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        },
      ],
    }

    const updatedVault = await saveVaultData(vault, encryptionKey, newData)
    const { data } = await unlockWithPassword(updatedVault, password)

    expect(data.accounts.length).toBe(1)
    expect(data.accounts[0].issuer).toBe('GitHub')
  })

  it('保存后 updatedAt 应该更新', async () => {
    const password = 'test-password-123'
    const { vault, encryptionKey } = await createVault(USERNAME, password)

    await new Promise((resolve) => setTimeout(resolve, 10)) // 等待 10ms 确保时间戳不同

    const newData: VaultData = { accounts: [] }
    const updatedVault = await saveVaultData(vault, encryptionKey, newData)

    expect(new Date(updatedVault.updatedAt).getTime()).toBeGreaterThan(
      new Date(vault.updatedAt).getTime()
    )
  })
})

describe('信封加密 - 更改登录密码', () => {
  it('应该成功更改登录密码', async () => {
    const oldPassword = 'old-password-123'
    const newPassword = 'new-password-456'
    const { vault, recoveryCode } = await createVault(USERNAME, oldPassword)

    const { vault: updatedVault, loginHash } = await changePassword(
      vault,
      oldPassword,
      newPassword
    )

    // 登录哈希应该已更新
    expect(updatedVault.loginHash).toBe(loginHash)
    expect(updatedVault.loginHash).not.toBe(vault.loginHash)

    // 旧密码应该失效
    await expect(
      unlockWithPassword(updatedVault, oldPassword)
    ).rejects.toThrow('解密失败')

    // 新密码应该可以解锁
    const { data } = await unlockWithPassword(updatedVault, newPassword)
    expect(data.accounts).toEqual([])

    // 恢复码应该仍然有效
    const { data: recoveryData } = await unlockWithRecoveryCode(
      updatedVault,
      recoveryCode
    )
    expect(recoveryData.accounts).toEqual([])
  })

  it('旧密码错误应该无法更改密码', async () => {
    const password = 'test-password-123'
    const { vault } = await createVault(USERNAME, password)

    await expect(
      changePassword(vault, 'wrong-old-password', 'new-password-456')
    ).rejects.toThrow('解密失败')
  })

  it('新密码少于 8 个字符应该抛出错误', async () => {
    const password = 'test-password-123'
    const { vault } = await createVault(USERNAME, password)

    await expect(changePassword(vault, password, 'short')).rejects.toThrow(
      '新登录密码至少 8 个字符'
    )
  })

  it('更改密码后保险库数据应该不变', async () => {
    const oldPassword = 'old-password-123'
    const newPassword = 'new-password-456'
    const { vault, encryptionKey } = await createVault(USERNAME, oldPassword)

    // 添加数据
    const testData: VaultData = {
      accounts: [
        {
          id: '1',
          issuer: 'Test',
          label: 'test@example.com',
          secret: 'SECRET',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          type: 'totp',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        },
      ],
    }
    const vaultWithData = await saveVaultData(vault, encryptionKey, testData)

    // 更改密码
    const { vault: updatedVault } = await changePassword(
      vaultWithData,
      oldPassword,
      newPassword
    )

    // 用新密码解锁，数据应该完整
    const { data } = await unlockWithPassword(updatedVault, newPassword)
    expect(data.accounts.length).toBe(1)
    expect(data.accounts[0].issuer).toBe('Test')
  })
})
