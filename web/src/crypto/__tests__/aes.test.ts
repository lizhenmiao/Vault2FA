import { describe, it, expect } from 'vitest'
import {
  encrypt,
  decrypt,
  stringToBytes,
  bytesToString,
  base64Encode,
  base64Decode,
} from '../aes'

describe('AES-256-GCM 加解密', () => {
  const testKey = crypto.getRandomValues(new Uint8Array(32))

  it('应该正确加密和解密数据', async () => {
    const plaintext = stringToBytes('Hello, 2FA!')
    const encrypted = await encrypt(plaintext, testKey)
    const decrypted = await decrypt(encrypted.nonce, encrypted.ciphertext, testKey)

    expect(bytesToString(decrypted)).toBe('Hello, 2FA!')
  })

  it('每次加密应该生成不同的 nonce', async () => {
    const plaintext = stringToBytes('test')
    const encrypted1 = await encrypt(plaintext, testKey)
    const encrypted2 = await encrypt(plaintext, testKey)

    expect(encrypted1.nonce).not.toEqual(encrypted2.nonce)
    expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext)
  })

  it('nonce 应该是 12 字节', async () => {
    const plaintext = stringToBytes('test')
    const encrypted = await encrypt(plaintext, testKey)

    expect(encrypted.nonce.length).toBe(12)
  })

  it('错误的密钥应该解密失败', async () => {
    const plaintext = stringToBytes('test')
    const encrypted = await encrypt(plaintext, testKey)
    const wrongKey = crypto.getRandomValues(new Uint8Array(32))

    await expect(
      decrypt(encrypted.nonce, encrypted.ciphertext, wrongKey)
    ).rejects.toThrow('解密失败')
  })

  it('篡改的密文应该解密失败', async () => {
    const plaintext = stringToBytes('test')
    const encrypted = await encrypt(plaintext, testKey)

    // 篡改密文的最后一个字节
    const tamperedCiphertext = new Uint8Array(encrypted.ciphertext)
    tamperedCiphertext[tamperedCiphertext.length - 1] ^= 0xFF

    await expect(
      decrypt(encrypted.nonce, tamperedCiphertext, testKey)
    ).rejects.toThrow('解密失败')
  })

  it('密钥长度不是 32 字节应该抛出错误', async () => {
    const plaintext = stringToBytes('test')
    const shortKey = new Uint8Array(16)

    await expect(encrypt(plaintext, shortKey)).rejects.toThrow(
      'AES-256-GCM 需要 32 字节密钥'
    )
  })
})

describe('工具函数', () => {
  it('stringToBytes 和 bytesToString 应该正确转换', () => {
    const str = 'Hello, 世界! 🔐'
    const bytes = stringToBytes(str)
    const decoded = bytesToString(bytes)

    expect(decoded).toBe(str)
  })

  it('base64Encode 和 base64Decode 应该正确转换', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const encoded = base64Encode(bytes)
    const decoded = base64Decode(encoded)

    expect(decoded).toEqual(bytes)
  })

  it('base64 编码应该是字符串', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const encoded = base64Encode(bytes)

    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)
  })
})
