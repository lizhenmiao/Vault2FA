import type { EncryptedVault, VaultData } from '@/crypto/types'
import type { Account } from '@/totp/types'

/**
 * 智能合并两个 vault 的账户数据
 *
 * 策略：
 * - 以 updatedAt 时间戳为准
 * - 相同 ID 的账户，保留更新时间晚的
 * - 软删除的账户保留（deletedAt 不为 null）
 *
 * @param local - 本地 vault 数据
 * @param remote - 远程 vault 数据
 * @returns 合并后的 vault 数据
 */
export function mergeVaultData(local: VaultData, remote: VaultData): VaultData {
  const accountMap = new Map<string, Account>()

  // 先添加本地账户
  for (const account of local.accounts) {
    accountMap.set(account.id, account)
  }

  // 合并远程账户
  for (const remoteAccount of remote.accounts) {
    const localAccount = accountMap.get(remoteAccount.id)

    if (!localAccount) {
      // 远程有，本地没有 → 添加
      accountMap.set(remoteAccount.id, remoteAccount)
    } else {
      // 两边都有 → 保留更新时间晚的
      const localUpdated = new Date(localAccount.updatedAt).getTime()
      const remoteUpdated = new Date(remoteAccount.updatedAt).getTime()

      if (remoteUpdated > localUpdated) {
        accountMap.set(remoteAccount.id, remoteAccount)
      }
    }
  }

  return {
    accounts: Array.from(accountMap.values()),
  }
}

/**
 * 检查两个 vault 是否冲突
 *
 * @param local - 本地 vault
 * @param remote - 远程 vault
 * @returns 是否存在冲突
 */
export function hasConflict(local: EncryptedVault, remote: EncryptedVault): boolean {
  // 比较 updatedAt 时间戳
  const localTime = new Date(local.updatedAt).getTime()
  const remoteTime = new Date(remote.updatedAt).getTime()

  // 如果时间戳相差超过 1 秒，且都不为 0，则认为可能有冲突
  return Math.abs(localTime - remoteTime) > 1000 && localTime > 0 && remoteTime > 0
}
