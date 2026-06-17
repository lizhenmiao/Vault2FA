/**
 * TOTP 模块统一导出
 */

// 类型
export type { Account, TOTPToken, ParsedOTPAuthURI } from './types'

// URI 解析
export {
  parseOTPAuthURI,
  isValidBase32Secret,
  generateOTPAuthURI,
} from './parser'

// Google Authenticator 批量导入
export {
  parseGoogleMigrationURI,
  isGoogleMigrationURI,
} from './migration'

// 验证码生成
export {
  generateTOTP,
  getRemainingSeconds,
  verifyTOTP,
  generateBatchTOTP,
} from './generator'

// 工具函数
export {
  generateUUID,
  createAccountFromParsed,
  softDeleteAccount,
  updateAccount,
  filterActiveAccounts,
  sortAccounts,
  searchAccounts,
} from './utils'
