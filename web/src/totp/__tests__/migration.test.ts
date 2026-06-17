import { describe, it, expect } from 'vitest'
import protobuf from 'protobufjs'
import { parseGoogleMigrationURI, isGoogleMigrationURI } from '../migration'

/**
 * 测试辅助：用 protobufjs 编码出一个真实有效的 Google 导出 URI
 *
 * 不手工编造 Base64，而是用与 migration.ts 相同的 schema 真实编码，
 * 保证测试数据 100% 有效（round-trip 验证解码逻辑）。
 */
const ENCODER_PROTO = `
syntax = "proto3";
message MigrationPayload {
  repeated OtpParameters otp_parameters = 1;
  int32 version = 2;
  int32 batch_size = 3;
  int32 batch_index = 4;
  int32 batch_id = 5;
}
message OtpParameters {
  bytes secret = 1;
  string name = 2;
  string issuer = 3;
  enum Algorithm { ALGORITHM_UNSPECIFIED = 0; ALGORITHM_SHA1 = 1; ALGORITHM_SHA256 = 2; ALGORITHM_SHA512 = 3; }
  Algorithm algorithm = 4;
  enum DigitCount { DIGIT_COUNT_UNSPECIFIED = 0; DIGIT_COUNT_SIX = 1; DIGIT_COUNT_EIGHT = 2; }
  DigitCount digits = 5;
  enum OtpType { OTP_TYPE_UNSPECIFIED = 0; OTP_TYPE_HOTP = 1; OTP_TYPE_TOTP = 2; }
  OtpType type = 6;
  int64 counter = 7;
}
`

interface OtpParam {
  secret: Uint8Array
  name: string
  issuer: string
  algorithm: number
  digits: number
  type: number
}

/** 用 protobuf 编码生成一个 otpauth-migration:// URI */
function buildMigrationURI(params: OtpParam[]): string {
  const root = protobuf.parse(ENCODER_PROTO).root
  const PayloadType = root.lookupType('MigrationPayload')

  const message = PayloadType.create({
    otpParameters: params,
    version: 1,
    batchSize: 1,
    batchIndex: 0,
    batchId: 0,
  })

  const buffer = PayloadType.encode(message).finish()

  // 调试：验证编码是否成功
  const decoded = PayloadType.decode(buffer) as any
  if (!decoded.otpParameters || decoded.otpParameters.length === 0) {
    console.error('编码后立即解码失败，payload:', decoded)
    throw new Error('测试辅助函数编码失败')
  }

  // 正确的二进制到 Base64：逐字节转换避免高位字节问题
  let binary = ''
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  const base64 = btoa(binary)
  return `otpauth-migration://offline?data=${base64}`
}

describe('Google Authenticator 批量导入', () => {
  describe('isGoogleMigrationURI', () => {
    it('应识别 Google 导出 URI', () => {
      const uri = buildMigrationURI([
        { secret: new Uint8Array([1, 2, 3, 4, 5]), name: 'GitHub:john@email', issuer: 'GitHub', algorithm: 1, digits: 1, type: 2 },
      ])
      expect(isGoogleMigrationURI(uri)).toBe(true)
    })

    it('应拒绝标准 otpauth URI', () => {
      expect(
        isGoogleMigrationURI('otpauth://totp/GitHub:user@email?secret=ABCD&issuer=GitHub')
      ).toBe(false)
    })

    it('应拒绝空字符串', () => {
      expect(isGoogleMigrationURI('')).toBe(false)
    })
  })

  describe('parseGoogleMigrationURI', () => {
    it('应成功解析包含多个账户的 URI', () => {
      const uri = buildMigrationURI([
        { secret: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), name: 'GitHub:john@email', issuer: 'GitHub', algorithm: 1, digits: 1, type: 2 },
        { secret: new Uint8Array([0x57, 0x6f, 0x72, 0x6c, 0x64]), name: 'Google:jane@email', issuer: 'Google', algorithm: 1, digits: 1, type: 2 },
      ])

      const accounts = parseGoogleMigrationURI(uri)
      expect(accounts).toHaveLength(2)

      expect(accounts[0]).toMatchObject({
        issuer: 'GitHub',
        label: 'john@email',
        type: 'totp',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      })
      expect(accounts[1]).toMatchObject({
        issuer: 'Google',
        label: 'jane@email',
        type: 'totp',
      })
    })

    it('解析后的 secret 应该是有效的 Base32', () => {
      const uri = buildMigrationURI([
        { secret: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), name: 'Test:user', issuer: 'Test', algorithm: 1, digits: 1, type: 2 },
      ])
      const accounts = parseGoogleMigrationURI(uri)
      const base32Regex = /^[A-Z2-7]+=*$/
      expect(base32Regex.test(accounts[0].secret)).toBe(true)
    })

    it('应正确映射 SHA256 / SHA512 算法', () => {
      const uri = buildMigrationURI([
        { secret: new Uint8Array([1, 2, 3]), name: 'A:a', issuer: 'A', algorithm: 2, digits: 1, type: 2 },
        { secret: new Uint8Array([4, 5, 6]), name: 'B:b', issuer: 'B', algorithm: 3, digits: 2, type: 2 },
      ])
      const accounts = parseGoogleMigrationURI(uri)
      expect(accounts[0].algorithm).toBe('SHA256')
      expect(accounts[1].algorithm).toBe('SHA512')
      expect(accounts[1].digits).toBe(8)
    })

    it('应跳过非 TOTP（HOTP）账户', () => {
      const uri = buildMigrationURI([
        { secret: new Uint8Array([1, 2, 3]), name: 'TOTP:a', issuer: 'TOTP', algorithm: 1, digits: 1, type: 2 },
        { secret: new Uint8Array([4, 5, 6]), name: 'HOTP:b', issuer: 'HOTP', algorithm: 1, digits: 1, type: 1 },
      ])
      const accounts = parseGoogleMigrationURI(uri)
      expect(accounts).toHaveLength(1)
      expect(accounts[0].issuer).toBe('TOTP')
    })

    it('name 不含冒号时应使用 issuer 字段', () => {
      const uri = buildMigrationURI([
        { secret: new Uint8Array([1, 2, 3]), name: 'myaccount', issuer: 'MyService', algorithm: 1, digits: 1, type: 2 },
      ])
      const accounts = parseGoogleMigrationURI(uri)
      expect(accounts[0].issuer).toBe('MyService')
      expect(accounts[0].label).toBe('myaccount')
    })

    it('应拒绝标准 otpauth URI', () => {
      expect(() => {
        parseGoogleMigrationURI('otpauth://totp/GitHub:user?secret=ABCD&issuer=GitHub')
      }).toThrow('不是有效的 Google Authenticator 导出链接')
    })

    it('应拒绝空 data 参数', () => {
      expect(() => {
        parseGoogleMigrationURI('otpauth-migration://offline?data=')
      }).toThrow('导出链接中没有数据')
    })
  })
})
