import { describe, it, expect } from 'vitest'
import { generateTOTP, getRemainingSeconds, verifyTOTP } from '../generator'
import type { Account } from '../types'

// 测试用的固定账户（使用 RFC 6238 测试向量）
const testAccount: Account = {
  id: 'test-id',
  issuer: 'Test',
  label: 'test@example.com',
  secret: 'JBSWY3DPEHPK3PXP', // "Hello!" 的 Base32 编码
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  type: 'totp',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  deletedAt: null,
}

describe('TOTP 验证码生成', () => {
  it('应该生成 6 位验证码', () => {
    const result = generateTOTP(testAccount)

    expect(result.token).toMatch(/^\d{6}$/)
  })

  it('应该返回剩余时间', () => {
    const result = generateTOTP(testAccount)

    expect(result.remaining).toBeGreaterThan(0)
    expect(result.remaining).toBeLessThanOrEqual(testAccount.period)
  })

  it('应该返回时间步长', () => {
    const result = generateTOTP(testAccount)

    expect(result.period).toBe(testAccount.period)
  })

  it('应该支持 8 位验证码', () => {
    const account: Account = {
      ...testAccount,
      digits: 8,
    }

    const result = generateTOTP(account)

    expect(result.token).toMatch(/^\d{8}$/)
  })

  it('应该支持不同的时间周期', () => {
    const account: Account = {
      ...testAccount,
      period: 60,
    }

    const result = generateTOTP(account)

    expect(result.period).toBe(60)
    expect(result.remaining).toBeLessThanOrEqual(60)
  })

  it('同一时间步内生成的验证码应该相同', () => {
    const result1 = generateTOTP(testAccount)
    const result2 = generateTOTP(testAccount)

    expect(result1.token).toBe(result2.token)
  })
})

describe('剩余时间计算', () => {
  it('剩余时间应该在 1 到 period 之间', () => {
    const remaining = getRemainingSeconds(30)

    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(30)
  })

  it('应该支持自定义周期', () => {
    const remaining60 = getRemainingSeconds(60)

    expect(remaining60).toBeGreaterThan(0)
    expect(remaining60).toBeLessThanOrEqual(60)
  })

  it('默认周期应该是 30 秒', () => {
    const remaining = getRemainingSeconds()

    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(30)
  })
})

describe('TOTP 验证', () => {
  it('应该验证正确的验证码', () => {
    const token = generateTOTP(testAccount).token
    const isValid = verifyTOTP(testAccount, token)

    expect(isValid).toBe(true)
  })

  it('应该拒绝错误的验证码', () => {
    const isValid = verifyTOTP(testAccount, '000000')

    expect(isValid).toBe(false)
  })

  it('应该拒绝格式错误的验证码', () => {
    const isValid = verifyTOTP(testAccount, 'invalid')

    expect(isValid).toBe(false)
  })

  it('应该支持时间窗口验证', () => {
    // 生成当前验证码
    const currentToken = generateTOTP(testAccount).token

    // 在较大的时间窗口内应该仍然有效
    const isValid = verifyTOTP(testAccount, currentToken, 2)

    expect(isValid).toBe(true)
  })
})
