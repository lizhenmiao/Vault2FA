/**
 * 加密模块统一导出
 */

// 类型
export type {
  KdfConfig,
  WrappedKey,
  EncryptedVault,
  VaultData,
  Account,
  EncryptedData,
} from './types'

// Argon2id 密钥派生
export { deriveKey, generateSalt, DEFAULT_KDF_CONFIG } from './argon2'

// 双密钥派生（登录密码 → 加密密钥 + 登录哈希）
export {
  deriveMasterKey,
  deriveEncryptionKey,
  deriveLoginHash,
  deriveKeys,
} from './derive'

// AES-GCM 加解密
export {
  encrypt,
  decrypt,
  stringToBytes,
  bytesToString,
  base64Encode,
  base64Decode,
} from './aes'

// 恢复码
export {
  generateRecoveryCode,
  isValidRecoveryCode,
  normalizeRecoveryCode,
} from './recovery'

// 信封加密（核心接口）
export {
  createVault,
  unlockWithPassword,
  unlockWithEncryptionKey,
  unlockWithRecoveryCode,
  saveVaultData,
  changePassword,
} from './envelope'
