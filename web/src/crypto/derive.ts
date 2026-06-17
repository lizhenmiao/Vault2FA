import { argon2id } from 'hash-wasm'
import { base64Encode } from './aes'
import { DEFAULT_KDF_CONFIG } from './argon2'
import type { KdfConfig } from './types'

/**
 * 双密钥派生模块（对标 Bitwarden / Vaultwarden）
 *
 * 用户只输入「登录密码」，配合「用户名」（作为固定 salt），派生出：
 *   - 主密钥 MasterKey：唯一一次昂贵的 Argon2id 派生，抗 GPU 暴力破解
 *   - 加密密钥 EncryptionKey：HKDF(主密钥, "enc")，前端加解密用，永不离开浏览器
 *   - 登录哈希 LoginHash：HKDF(主密钥, "auth")，发后端鉴权用，无法反推主密钥/加密密钥
 *
 * 安全要点：
 *   - 后端只拿到「登录哈希」，由 HKDF 单向派生，无法反推出主密钥或加密密钥
 *     → 后端无法解密 vault，实现真正的端到端加密
 *   - 算法全公开，安全性只依赖登录密码强度（柯克霍夫原则）
 *   - 加密密钥与登录哈希用不同 info 标签从主密钥分流，互不泄露
 */

/** HKDF 派生加密密钥时使用的 info 标签 */
const INFO_ENCRYPTION = '2fa-encryption-key'

/** HKDF 派生登录哈希时使用的 info 标签 */
const INFO_LOGIN = '2fa-login-hash'

/**
 * 将任意字符串通过 SHA-256 转为固定 32 字节的 salt
 *
 * Argon2id 要求 salt 至少 16 字节，而用户名/登录密码长度不定，
 * 故先用 SHA-256 规整为确定性的 32 字节 salt。
 *
 * @param input - 输入字符串（用户名或登录密码）
 * @returns 32 字节 salt
 */
async function deriveSalt(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hash)
}

/**
 * 派生主密钥（唯一一次昂贵的 Argon2id）
 *
 * @param password - 登录密码
 * @param username - 用户名（作为固定 salt 的来源）
 * @param config - KDF 配置（默认 64MiB / 3 轮 / 并行度 1）
 * @returns 32 字节主密钥
 */
export async function deriveMasterKey(
  password: string,
  username: string,
  config: KdfConfig = DEFAULT_KDF_CONFIG
): Promise<Uint8Array> {
  if (!username) {
    throw new Error('用户名不能为空')
  }

  const salt = await deriveSalt(username)
  const key = await argon2id({
    password,
    salt,
    parallelism: config.parallelism,
    iterations: config.iterations,
    memorySize: config.memKiB,
    hashLength: 32,
    outputType: 'binary',
  })

  return key
}

/**
 * 用 HKDF 从主密钥派生子密钥（廉价、单向）
 *
 * @param masterKey - 主密钥
 * @param info - 区分用途的 info 标签
 * @returns 32 字节子密钥
 */
async function hkdfExpand(masterKey: Uint8Array, info: string): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    masterKey as Uint8Array<ArrayBuffer>,
    'HKDF',
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0) as Uint8Array<ArrayBuffer>,
      info: new TextEncoder().encode(info) as Uint8Array<ArrayBuffer>,
    },
    baseKey,
    256 // 32 字节
  )

  return new Uint8Array(bits)
}

/**
 * 从主密钥派生加密密钥（前端加解密用，永不离开浏览器）
 *
 * @param masterKey - 主密钥
 * @returns 32 字节加密密钥
 */
export async function deriveEncryptionKey(masterKey: Uint8Array): Promise<Uint8Array> {
  return hkdfExpand(masterKey, INFO_ENCRYPTION)
}

/**
 * 从主密钥派生登录哈希（发后端鉴权用）
 *
 * @param masterKey - 主密钥
 * @returns Base64 编码的登录哈希
 */
export async function deriveLoginHash(masterKey: Uint8Array): Promise<string> {
  const hash = await hkdfExpand(masterKey, INFO_LOGIN)
  return base64Encode(hash)
}

/**
 * 一次性派生「加密密钥」和「登录哈希」
 *
 * 解锁/创建时调用，跑一次 Argon2id 得到主密钥，再用 HKDF 分流出两把密钥。
 *
 * @param password - 登录密码
 * @param username - 用户名
 * @param config - KDF 配置
 * @returns 加密密钥（Uint8Array）+ 登录哈希（Base64 字符串）
 */
export async function deriveKeys(
  password: string,
  username: string,
  config: KdfConfig = DEFAULT_KDF_CONFIG
): Promise<{ encryptionKey: Uint8Array; loginHash: string }> {
  const masterKey = await deriveMasterKey(password, username, config)
  const encryptionKey = await deriveEncryptionKey(masterKey)
  const loginHash = await deriveLoginHash(masterKey)
  return { encryptionKey, loginHash }
}
