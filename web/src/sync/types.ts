/**
 * 同步相关类型定义
 */

import type { EncryptedVault } from '@/crypto/types'

/**
 * 同步状态
 */
export interface SyncStatus {
  lastSyncAt: string | null // 最后同步时间
  lastVersion: string | null // 最后同步的版本号
  isSyncing: boolean // 是否正在同步
  error: string | null // 最后的错误
}

/**
 * 远程数据
 */
export interface RemoteData {
  vault: EncryptedVault
  version: string
}
