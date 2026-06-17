/**
 * TOTP 模块类型定义
 */

/**
 * TOTP 账户
 */
export interface Account {
  id: string // UUID
  issuer: string // 发行方（如 "GitHub"）
  label: string // 标签（通常是邮箱或用户名）
  secret: string // Base32 编码的密钥
  algorithm: 'SHA1' | 'SHA256' | 'SHA512' // HMAC 算法
  digits: number // 验证码位数（通常 6 或 8）
  period: number // 时间步长（秒，通常 30）
  type: 'totp' | 'hotp' // 类型（目前仅支持 TOTP）
  createdAt: string // ISO 8601 时间戳
  updatedAt: string // ISO 8601 时间戳
  deletedAt: string | null // 软删除时间戳（null 表示未删除）
}

/**
 * TOTP 验证码生成结果
 */
export interface TOTPToken {
  token: string // 验证码（如 "123456"）
  remaining: number // 剩余秒数（距离下一次刷新）
  period: number // 时间步长（秒）
}

/**
 * 从 otpauth URI 解析出的数据
 */
export interface ParsedOTPAuthURI {
  issuer: string
  label: string
  secret: string
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'
  digits: number
  period: number
  type: 'totp' | 'hotp'
}
