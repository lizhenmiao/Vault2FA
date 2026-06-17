import type { EncryptedData } from './types'

/**
 * AES-256-GCM 加密
 *
 * @param plaintext - 明文（Uint8Array）
 * @param key - 加密密钥（32 字节）
 * @returns 加密结果（nonce + 密文 + GCM 认证标签）
 */
export async function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<EncryptedData> {
  if (key.length !== 32) {
    throw new Error('AES-256-GCM 需要 32 字节密钥')
  }

  // 生成随机 nonce（96 位 = 12 字节）
  const nonce = crypto.getRandomValues(new Uint8Array(12))

  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as Uint8Array<ArrayBuffer>, // TS 6.0 类型收紧，显式断言
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  // 加密（密文会包含 GCM 认证标签）
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce as Uint8Array<ArrayBuffer>,
      tagLength: 128, // GCM 认证标签 128 位
    },
    cryptoKey,
    plaintext as Uint8Array<ArrayBuffer>
  )

  return {
    nonce,
    ciphertext: new Uint8Array(ciphertext),
  }
}

/**
 * AES-256-GCM 解密
 *
 * @param nonce - nonce（12 字节）
 * @param ciphertext - 密文（包含 GCM 认证标签）
 * @param key - 解密密钥（32 字节）
 * @returns 明文
 * @throws 如果认证标签验证失败（数据被篡改）
 */
export async function decrypt(
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  if (key.length !== 32) {
    throw new Error('AES-256-GCM 需要 32 字节密钥')
  }

  if (nonce.length !== 12) {
    throw new Error('AES-GCM nonce 必须 12 字节')
  }

  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as Uint8Array<ArrayBuffer>,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // 解密（会自动验证 GCM 认证标签）
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce as Uint8Array<ArrayBuffer>,
        tagLength: 128,
      },
      cryptoKey,
      ciphertext as Uint8Array<ArrayBuffer>
    )

    return new Uint8Array(plaintext)
  } catch (error) {
    throw new Error('解密失败：密钥错误或数据已被篡改')
  }
}

/**
 * 字符串转 Uint8Array（UTF-8 编码）
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

/**
 * Uint8Array 转字符串（UTF-8 解码）
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/**
 * Base64 编码
 */
export function base64Encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Base64 解码
 */
export function base64Decode(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}
