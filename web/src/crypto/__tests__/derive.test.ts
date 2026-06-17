import { describe, it, expect } from 'vitest'
import {
  deriveMasterKey,
  deriveEncryptionKey,
  deriveLoginHash,
  deriveKeys,
} from '../derive'

const USERNAME = 'testuser'
const PASSWORD = 'test-password-123'

describe('双密钥派生 - 主密钥', () => {
  it('相同用户名+密码应派生出相同主密钥（确定性）', async () => {
    const a = await deriveMasterKey(PASSWORD, USERNAME)
    const b = await deriveMasterKey(PASSWORD, USERNAME)
    expect(a).toEqual(b)
    expect(a.length).toBe(32)
  })

  it('不同密码应派生出不同主密钥', async () => {
    const a = await deriveMasterKey(PASSWORD, USERNAME)
    const b = await deriveMasterKey('other-password-456', USERNAME)
    expect(a).not.toEqual(b)
  })

  it('不同用户名（salt）应派生出不同主密钥', async () => {
    const a = await deriveMasterKey(PASSWORD, USERNAME)
    const b = await deriveMasterKey(PASSWORD, 'anotheruser')
    expect(a).not.toEqual(b)
  })

  it('用户名为空应抛出错误', async () => {
    await expect(deriveMasterKey(PASSWORD, '')).rejects.toThrow('用户名不能为空')
  })
})

describe('双密钥派生 - HKDF 分流', () => {
  it('加密密钥与登录哈希应互不相同（不同 info 标签）', async () => {
    const masterKey = await deriveMasterKey(PASSWORD, USERNAME)
    const encKey = await deriveEncryptionKey(masterKey)
    const loginHash = await deriveLoginHash(masterKey)

    // 加密密钥是 32 字节
    expect(encKey.length).toBe(32)
    // 登录哈希是 Base64 字符串
    expect(typeof loginHash).toBe('string')

    // 把加密密钥也编码成 Base64 与登录哈希比较，应不相同
    const encKeyB64 = btoa(String.fromCharCode(...encKey))
    expect(encKeyB64).not.toBe(loginHash)
  })

  it('相同主密钥应派生出相同的加密密钥和登录哈希', async () => {
    const masterKey = await deriveMasterKey(PASSWORD, USERNAME)
    const enc1 = await deriveEncryptionKey(masterKey)
    const enc2 = await deriveEncryptionKey(masterKey)
    const hash1 = await deriveLoginHash(masterKey)
    const hash2 = await deriveLoginHash(masterKey)

    expect(enc1).toEqual(enc2)
    expect(hash1).toBe(hash2)
  })
})

describe('双密钥派生 - deriveKeys 一次性派生', () => {
  it('应同时返回加密密钥和登录哈希', async () => {
    const { encryptionKey, loginHash } = await deriveKeys(PASSWORD, USERNAME)
    expect(encryptionKey).toBeInstanceOf(Uint8Array)
    expect(encryptionKey.length).toBe(32)
    expect(typeof loginHash).toBe('string')
  })

  it('deriveKeys 结果应与分步派生一致', async () => {
    const masterKey = await deriveMasterKey(PASSWORD, USERNAME)
    const expectedEnc = await deriveEncryptionKey(masterKey)
    const expectedHash = await deriveLoginHash(masterKey)

    const { encryptionKey, loginHash } = await deriveKeys(PASSWORD, USERNAME)
    expect(encryptionKey).toEqual(expectedEnc)
    expect(loginHash).toBe(expectedHash)
  })
})
