import { URI, TOTP } from 'otpauth'
import type { ParsedOTPAuthURI } from './types'

/**
 * 解析 otpauth URI
 *
 * 示例 URI:
 * otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
 *
 * @param uri - otpauth URI 字符串
 * @returns 解析后的账户信息
 * @throws 如果 URI 格式错误或缺少必需参数
 */
export function parseOTPAuthURI(uri: string): ParsedOTPAuthURI {
  try {
    const otp = URI.parse(uri)

    // 验证类型（目前仅支持 TOTP）
    if (!(otp instanceof TOTP)) {
      throw new Error('目前仅支持 TOTP 类型')
    }

    // 提取必需字段
    const secret = otp.secret.base32
    if (!secret) {
      throw new Error('缺少 secret 参数')
    }

    const label = otp.label || '未命名账户'
    const issuer = otp.issuer || extractIssuerFromLabel(label)

    // 提取可选字段（带默认值）
    const algorithm = normalizeAlgorithm(otp.algorithm)
    const digits = otp.digits || 6
    const period = otp.period || 30

    return {
      issuer,
      label,
      secret,
      algorithm,
      digits,
      period,
      type: 'totp',
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`解析 otpauth URI 失败: ${error.message}`)
    }
    throw new Error('解析 otpauth URI 失败: 未知错误')
  }
}

/**
 * 从标签中提取发行方（如果 URI 中未提供 issuer）
 *
 * 标签格式通常为 "Issuer:label" 或 "label"
 */
function extractIssuerFromLabel(label: string): string {
  const colonIndex = label.indexOf(':')
  if (colonIndex > 0) {
    return label.substring(0, colonIndex).trim()
  }
  return '未知'
}

/**
 * 标准化算法名称
 */
function normalizeAlgorithm(algorithm: string): 'SHA1' | 'SHA256' | 'SHA512' {
  const normalized = algorithm.toUpperCase()
  if (normalized === 'SHA1' || normalized === 'SHA-1') {
    return 'SHA1'
  }
  if (normalized === 'SHA256' || normalized === 'SHA-256') {
    return 'SHA256'
  }
  if (normalized === 'SHA512' || normalized === 'SHA-512') {
    return 'SHA512'
  }
  return 'SHA1' // 默认
}

/**
 * 验证 Base32 密钥格式
 *
 * @param secret - Base32 编码的密钥
 * @returns 是否有效
 */
export function isValidBase32Secret(secret: string): boolean {
  // Base32 字符集：A-Z 和 2-7
  const base32Pattern = /^[A-Z2-7]+=*$/
  return base32Pattern.test(secret) && secret.length >= 16
}

/**
 * 生成 otpauth URI（用于导出二维码）
 *
 * @param account - 账户信息
 * @returns otpauth URI 字符串
 */
export function generateOTPAuthURI(account: {
  issuer: string
  label: string
  secret: string
  algorithm: string
  digits: number
  period: number
}): string {
  const params = new URLSearchParams({
    secret: account.secret,
    issuer: account.issuer,
    algorithm: account.algorithm,
    digits: account.digits.toString(),
    period: account.period.toString(),
  })

  // 标签格式：Issuer:label
  const fullLabel = `${account.issuer}:${account.label}`
  const encodedLabel = encodeURIComponent(fullLabel)

  return `otpauth://totp/${encodedLabel}?${params.toString()}`
}
