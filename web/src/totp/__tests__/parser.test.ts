import { describe, it, expect } from 'vitest'
import { parseOTPAuthURI, isValidBase32Secret, generateOTPAuthURI } from '../parser'

describe('otpauth URI 解析', () => {
  it('应该正确解析标准 TOTP URI', () => {
    const uri = 'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub'
    const parsed = parseOTPAuthURI(uri)

    expect(parsed.issuer).toBe('GitHub')
    expect(parsed.label).toBe('user@example.com')
    expect(parsed.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(parsed.algorithm).toBe('SHA1')
    expect(parsed.digits).toBe(6)
    expect(parsed.period).toBe(30)
    expect(parsed.type).toBe('totp')
  })

  it('应该处理缺少 issuer 参数的 URI', () => {
    const uri = 'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP'
    const parsed = parseOTPAuthURI(uri)

    expect(parsed.issuer).toBe('GitHub') // 从标签中提取
  })

  it('应该处理仅有 label 的 URI', () => {
    const uri = 'otpauth://totp/user@example.com?secret=JBSWY3DPEHPK3PXP'
    const parsed = parseOTPAuthURI(uri)

    expect(parsed.issuer).toBe('未知')
    expect(parsed.label).toBe('user@example.com')
  })

  it('应该解析自定义算法', () => {
    const uri = 'otpauth://totp/Test:user?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256'
    const parsed = parseOTPAuthURI(uri)

    expect(parsed.algorithm).toBe('SHA256')
  })

  it('应该解析自定义位数和周期', () => {
    const uri = 'otpauth://totp/Test:user?secret=JBSWY3DPEHPK3PXP&digits=8&period=60'
    const parsed = parseOTPAuthURI(uri)

    expect(parsed.digits).toBe(8)
    expect(parsed.period).toBe(60)
  })

  it('缺少 secret 应该抛出错误', () => {
    const uri = 'otpauth://totp/Test:user?issuer=Test'

    expect(() => parseOTPAuthURI(uri)).toThrow('解析 otpauth URI 失败')
  })

  it('无效的 URI 格式应该抛出错误', () => {
    const uri = 'not-a-valid-uri'

    expect(() => parseOTPAuthURI(uri)).toThrow('解析 otpauth URI 失败')
  })
})

describe('Base32 密钥验证', () => {
  it('应该验证有效的 Base32 密钥', () => {
    expect(isValidBase32Secret('JBSWY3DPEHPK3PXP')).toBe(true)
    expect(isValidBase32Secret('ABCDEFGHIJKLMNOP')).toBe(true)
    expect(isValidBase32Secret('234567ABCDEFGHIJ')).toBe(true)
  })

  it('应该拒绝无效的 Base32 密钥', () => {
    expect(isValidBase32Secret('abc')).toBe(false) // 小写
    expect(isValidBase32Secret('ABCD')).toBe(false) // 太短
    expect(isValidBase32Secret('ABCD1890EFGH')).toBe(false) // 包含非法字符 8, 9, 0
    expect(isValidBase32Secret('')).toBe(false) // 空字符串
  })
})

describe('生成 otpauth URI', () => {
  it('应该生成正确格式的 URI', () => {
    const account = {
      issuer: 'GitHub',
      label: 'user@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    }

    const uri = generateOTPAuthURI(account)

    // URI 会对标签进行编码，所以检查编码后的版本
    expect(uri).toContain('otpauth://totp/GitHub%3Auser%40example.com')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('issuer=GitHub')
    expect(uri).toContain('algorithm=SHA1')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
  })

  it('生成的 URI 应该能被解析回来', () => {
    const account = {
      issuer: 'Test',
      label: 'test@test.com',
      secret: 'ABCDEFGHIJKLMNOP',
      algorithm: 'SHA256',
      digits: 8,
      period: 60,
    }

    const uri = generateOTPAuthURI(account)
    const parsed = parseOTPAuthURI(uri)

    expect(parsed.issuer).toBe(account.issuer)
    expect(parsed.label).toBe(account.label)
    expect(parsed.secret).toBe(account.secret)
    expect(parsed.algorithm).toBe(account.algorithm)
    expect(parsed.digits).toBe(account.digits)
    expect(parsed.period).toBe(account.period)
  })
})
