import { TOTP } from 'otpauth'
import type { Account, TOTPToken } from './types'

/**
 * 生成 TOTP 验证码
 *
 * @param account - 账户信息
 * @returns 验证码 + 剩余时间
 */
export function generateTOTP(account: Account): TOTPToken {
  const totp = new TOTP({
    issuer: account.issuer,
    label: account.label,
    algorithm: account.algorithm,
    digits: account.digits,
    period: account.period,
    secret: account.secret,
  })

  const token = totp.generate()
  const remaining = getRemainingSeconds(account.period)

  return {
    token,
    remaining,
    period: account.period,
  }
}

/**
 * 计算当前时间步内的剩余秒数
 *
 * @param period - 时间步长（秒）
 * @returns 剩余秒数（1 ~ period）
 */
export function getRemainingSeconds(period: number = 30): number {
  const now = Math.floor(Date.now() / 1000)
  const elapsed = now % period
  return period - elapsed
}

/**
 * 验证 TOTP 验证码是否正确
 *
 * @param account - 账户信息
 * @param token - 用户输入的验证码
 * @param window - 时间窗口（允许前后 N 个时间步，默认 1）
 * @returns 是否验证通过
 */
export function verifyTOTP(
  account: Account,
  token: string,
  window: number = 1
): boolean {
  const totp = new TOTP({
    issuer: account.issuer,
    label: account.label,
    algorithm: account.algorithm,
    digits: account.digits,
    period: account.period,
    secret: account.secret,
  })

  // otpauth 的 validate 方法返回时间步差值，null 表示验证失败
  const delta = totp.validate({ token, window })
  return delta !== null
}

/**
 * 批量生成多个账户的验证码
 *
 * @param accounts - 账户列表
 * @returns 账户 ID 到验证码的映射
 */
export function generateBatchTOTP(
  accounts: Account[]
): Map<string, TOTPToken> {
  const results = new Map<string, TOTPToken>()

  for (const account of accounts) {
    if (!account.deletedAt) {
      // 跳过已删除的账户
      try {
        const token = generateTOTP(account)
        results.set(account.id, token)
      } catch (error) {
        console.error(`生成验证码失败 [${account.issuer}]: ${error}`)
      }
    }
  }

  return results
}
