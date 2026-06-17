import protobuf from 'protobufjs'
import type { ParsedOTPAuthURI } from './types'

/**
 * Google Authenticator 批量导出格式解码器
 *
 * Google 的导出格式：otpauth-migration://offline?data=BASE64_ENCODED_PROTOBUF
 *
 * Protobuf schema (来自 Google 开源代码):
 * message MigrationPayload {
 *   repeated OtpParameters otp_parameters = 1;
 *   int32 version = 2;
 *   int32 batch_size = 3;
 *   int32 batch_index = 4;
 *   int32 batch_id = 5;
 * }
 * message OtpParameters {
 *   bytes secret = 1;
 *   string name = 2;       // 格式: "issuer:label" 或 "label"
 *   string issuer = 3;
 *   enum Algorithm { ALGORITHM_UNSPECIFIED = 0; ALGORITHM_SHA1 = 1; ALGORITHM_SHA256 = 2; ALGORITHM_SHA512 = 3; }
 *   Algorithm algorithm = 4;
 *   enum DigitCount { DIGIT_COUNT_UNSPECIFIED = 0; DIGIT_COUNT_SIX = 1; DIGIT_COUNT_EIGHT = 2; }
 *   DigitCount digits = 5;
 *   enum OtpType { OTP_TYPE_UNSPECIFIED = 0; OTP_TYPE_HOTP = 1; OTP_TYPE_TOTP = 2; }
 *   OtpType type = 6;
 *   int64 counter = 7;
 * }
 */

// 手动定义 Protobuf schema（避免运行时加载 .proto 文件）
const migrationProto = `
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
  enum Algorithm {
    ALGORITHM_UNSPECIFIED = 0;
    ALGORITHM_SHA1 = 1;
    ALGORITHM_SHA256 = 2;
    ALGORITHM_SHA512 = 3;
    ALGORITHM_SHA224 = 4;
    ALGORITHM_MD5 = 5;
  }
  Algorithm algorithm = 4;
  enum DigitCount {
    DIGIT_COUNT_UNSPECIFIED = 0;
    DIGIT_COUNT_SIX = 1;
    DIGIT_COUNT_EIGHT = 2;
  }
  DigitCount digits = 5;
  enum OtpType {
    OTP_TYPE_UNSPECIFIED = 0;
    OTP_TYPE_HOTP = 1;
    OTP_TYPE_TOTP = 2;
  }
  OtpType type = 6;
  int64 counter = 7;
}
`

// 懒加载 protobuf 类型（避免多次编译）
let MigrationPayload: protobuf.Type | null = null

function getMigrationPayloadType(): protobuf.Type {
  if (!MigrationPayload) {
    const root = protobuf.parse(migrationProto).root
    MigrationPayload = root.lookupType('MigrationPayload')
  }
  return MigrationPayload
}

/**
 * 解析 Google Authenticator 的批量导出 URI
 *
 * @param uri - otpauth-migration://offline?data=...
 * @returns 解析后的账户列表
 * @throws 如果 URI 格式错误或解码失败
 */
export function parseGoogleMigrationURI(uri: string): ParsedOTPAuthURI[] {
  try {
    // 1. 校验前缀
    if (!uri.startsWith('otpauth-migration://offline?data=')) {
      throw new Error('不是有效的 Google Authenticator 导出链接')
    }

    // 2. 提取 Base64 编码的数据
    const base64Data = uri.replace('otpauth-migration://offline?data=', '')
    if (!base64Data) {
      throw new Error('导出链接中没有数据')
    }

    // 真实 Google 二维码中 data 参数是 URL 编码的（+ / = 会被转义），需先解码
    const decodedBase64 = decodeURIComponent(base64Data)

    // 3. Base64 解码为二进制
    const binaryStr = atob(decodedBase64)
    const binaryData = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      binaryData[i] = binaryStr.charCodeAt(i)
    }

    // 4. Protobuf 解码
    const PayloadType = getMigrationPayloadType()
    const payload = PayloadType.decode(binaryData) as any

    if (!payload.otpParameters || payload.otpParameters.length === 0) {
      throw new Error('导出链接中没有账户数据')
    }

    // 5. 转换为标准格式
    const accounts: ParsedOTPAuthURI[] = []

    for (const otp of payload.otpParameters) {
      // 目前只支持 TOTP
      if (otp.type !== 2) {
        console.warn('跳过非 TOTP 账户:', otp.name)
        continue
      }

      // 解析 name 字段 (格式可能是 "issuer:label" 或 "label")
      let issuer = otp.issuer || ''
      let label = otp.name || '未命名账户'

      if (label.includes(':')) {
        const parts = label.split(':', 2)
        if (!issuer) {
          issuer = parts[0]
        }
        label = parts[1] || parts[0]
      }

      // secret 是 bytes，需要转成 Base32
      const secret = bytesToBase32(otp.secret)

      // 映射算法
      const algorithmMap: Record<number, 'SHA1' | 'SHA256' | 'SHA512'> = {
        1: 'SHA1',
        2: 'SHA256',
        3: 'SHA512',
      }
      const algorithm = algorithmMap[otp.algorithm] || 'SHA1'

      // 映射位数
      const digitsMap: Record<number, number> = {
        1: 6,
        2: 8,
      }
      const digits = digitsMap[otp.digits] || 6

      accounts.push({
        issuer: issuer || '未知服务',
        label,
        secret,
        algorithm,
        digits,
        period: 30, // Google Authenticator 默认 30 秒
        type: 'totp',
      })
    }

    if (accounts.length === 0) {
      throw new Error('没有找到可导入的 TOTP 账户')
    }

    return accounts
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`解析 Google Authenticator 导出失败: ${error.message}`)
    }
    throw new Error('解析 Google Authenticator 导出失败: 未知错误')
  }
}

/**
 * 将 Uint8Array 转换为 Base32 字符串 (RFC 4648)
 */
function bytesToBase32(bytes: Uint8Array): string {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8

    while (bits >= 5) {
      output += base32Chars[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += base32Chars[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * 检测 URI 是否为 Google Authenticator 批量导出格式
 */
export function isGoogleMigrationURI(uri: string): boolean {
  return uri.startsWith('otpauth-migration://offline?data=')
}
