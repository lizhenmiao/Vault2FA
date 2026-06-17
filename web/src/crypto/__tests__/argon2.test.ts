import { describe, it, expect } from 'vitest'
import { deriveKey, generateSalt } from '../argon2'

describe('Argon2id 密钥派生', () => {
  it('应该生成 32 字节密钥', async () => {
    const password = 'test-password'
    const salt = generateSalt()
    const key = await deriveKey(password, salt)

    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  it('相同密码和盐值应该产生相同密钥（确定性）', async () => {
    const password = 'test-password'
    const salt = generateSalt()

    const key1 = await deriveKey(password, salt)
    const key2 = await deriveKey(password, salt)

    expect(key1).toEqual(key2)
  })

  it('不同盐值应该产生不同密钥', async () => {
    const password = 'test-password'
    const salt1 = generateSalt()
    const salt2 = generateSalt()

    const key1 = await deriveKey(password, salt1)
    const key2 = await deriveKey(password, salt2)

    expect(key1).not.toEqual(key2)
  })

  it('不同密码应该产生不同密钥', async () => {
    const salt = generateSalt()
    const key1 = await deriveKey('password1', salt)
    const key2 = await deriveKey('password2', salt)

    expect(key1).not.toEqual(key2)
  })

  it('盐值长度不足应该抛出错误', async () => {
    const password = 'test-password'
    const shortSalt = new Uint8Array(8) // 少于 16 字节

    await expect(deriveKey(password, shortSalt)).rejects.toThrow('盐值长度至少 16 字节')
  })

  it('generateSalt 应该生成随机盐值', () => {
    const salt1 = generateSalt()
    const salt2 = generateSalt()

    expect(salt1).toBeInstanceOf(Uint8Array)
    expect(salt1.length).toBe(32)
    expect(salt1).not.toEqual(salt2) // 随机性检查
  })
})
