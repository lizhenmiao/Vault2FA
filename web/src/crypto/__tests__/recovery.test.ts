import { describe, it, expect } from 'vitest'
import {
  generateRecoveryCode,
  isValidRecoveryCode,
  normalizeRecoveryCode,
} from '../recovery'

describe('恢复码生成', () => {
  it('应该生成正确格式的恢复码', () => {
    const code = generateRecoveryCode()

    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/)
  })

  it('每次生成的恢复码应该不同', () => {
    const code1 = generateRecoveryCode()
    const code2 = generateRecoveryCode()

    expect(code1).not.toBe(code2)
  })

  it('恢复码应该是 19 个字符（4组4字符 + 3个分隔符）', () => {
    const code = generateRecoveryCode()

    expect(code.length).toBe(19)
  })

  it('恢复码不应包含易混淆字符', () => {
    const code = generateRecoveryCode()

    expect(code).not.toMatch(/[0O1Il]/)
  })
})

describe('恢复码验证', () => {
  it('应该验证正确格式的恢复码', () => {
    const validCode = 'ABCD-EFGH-JKLM-NPQR'
    expect(isValidRecoveryCode(validCode)).toBe(true)
  })

  it('应该拒绝格式错误的恢复码', () => {
    expect(isValidRecoveryCode('ABCD-EFGH-JKLM')).toBe(false) // 缺少一组
    expect(isValidRecoveryCode('ABCD-EFGH-JKLM-NP')).toBe(false) // 最后一组太短
    expect(isValidRecoveryCode('ABCDEFGHJKLMNPQR')).toBe(false) // 缺少分隔符
    expect(isValidRecoveryCode('ABCD-EFGH-JKLM-0PQR')).toBe(false) // 包含禁用字符 0
    expect(isValidRecoveryCode('abcd-efgh-jklm-npqr')).toBe(false) // 小写
  })
})

describe('恢复码标准化', () => {
  it('应该转换为大写', () => {
    const normalized = normalizeRecoveryCode('abcd-efgh-jklm-npqr')
    expect(normalized).toBe('ABCD-EFGH-JKLM-NPQR')
  })

  it('应该去除空格', () => {
    const normalized = normalizeRecoveryCode('ABCD EFGH JKLM NPQR')
    expect(normalized).toBe('ABCDEFGHJKLMNPQR') // 没有分隔符了
  })

  it('应该保留分隔符', () => {
    const normalized = normalizeRecoveryCode('  ABCD-EFGH-JKLM-NPQR  ')
    expect(normalized).toBe('ABCD-EFGH-JKLM-NPQR')
  })

  it('应该过滤非法字符', () => {
    const normalized = normalizeRecoveryCode('ABCD-EFGH-JK*LM-NP@QR')
    expect(normalized).toBe('ABCD-EFGH-JKLM-NPQR')
  })
})
