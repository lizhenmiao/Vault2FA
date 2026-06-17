/**
 * 加密模块类型定义
 */

import type { Account } from '../totp/types'

/**
 * KDF（密钥派生函数）配置
 */
export interface KdfConfig {
  algo: 'argon2id'
  memKiB: number // 内存成本（KiB）
  iterations: number // 迭代次数
  parallelism: number // 并行度
}

/**
 * 包裹的密钥（用加密密钥或恢复码派生的密钥加密 DEK 后的结果）
 *
 * salt 为可选：
 *   - 登录密码分支（password）不需要独立 salt，因为加密密钥由「用户名+登录密码」派生（salt=用户名已在顶层）
 *   - 恢复码分支（recovery）需要独立随机 salt
 */
export interface WrappedKey {
  salt?: string // Base64 编码的盐值（恢复码分支才有）
  nonce: string // Base64 编码的 nonce
  ct: string // Base64 编码的密文（加密后的 DEK）
}

/**
 * 加密的保险库（存储格式，v2）
 *
 * v2 相比 v1 的变化（双密钥派生架构）：
 *   - 新增 username：明文存储，作为登录密码派生加密密钥的 salt（非敏感）
 *   - 新增 loginHash：登录哈希，后端用它鉴权，无法反推加密密钥
 *   - wrappedKeys.password 不再需要独立 salt
 */
export interface EncryptedVault {
  version: number // 格式版本号（当前为 2）
  username: string // 明文用户名（派生 salt 来源，非敏感）
  kdf: KdfConfig // KDF 配置
  loginHash: string // Base64 登录哈希（后端鉴权用，无法反推加密密钥）
  wrappedKeys: {
    password: WrappedKey // 加密密钥（登录密码派生）包裹的 DEK
    recovery: WrappedKey // 恢复码包裹的 DEK
  }
  vault: {
    nonce: string // Base64 编码的 nonce
    ct: string // Base64 编码的密文（加密后的 vault 数据）
  }
  updatedAt: string // ISO 8601 时间戳
}

/**
 * 解密后的保险库数据（业务数据）
 * Account 类型从 totp/types.ts 导入，避免重复定义
 */
export interface VaultData {
  accounts: Account[]
}

// 重新导出 Account，供外部统一从 crypto 导入
export type { Account }

/**
 * 内部：AES-GCM 加密结果
 */
export interface EncryptedData {
  nonce: Uint8Array // 随机 nonce（96 位）
  ciphertext: Uint8Array // 密文 + GCM 认证标签
}
