import { argon2id } from 'hash-wasm'
import type { KdfConfig } from './types'

/**
 * 默认 KDF 配置
 * - 内存 64 MiB（抗 GPU 暴力破解）
 * - 迭代 3 次（平衡安全性与速度）
 * - 并行度 1（浏览器环境）
 */
export const DEFAULT_KDF_CONFIG: KdfConfig = {
  algo: 'argon2id',
  memKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 1,
}

/**
 * 使用 Argon2id 从密码派生密钥
 *
 * @param password - 用户输入的密码或恢复码
 * @param salt - 盐值（Uint8Array，至少 16 字节）
 * @param config - KDF 配置
 * @returns 派生的密钥（32 字节，用于 AES-256-GCM）
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  config: KdfConfig = DEFAULT_KDF_CONFIG
): Promise<Uint8Array> {
  if (salt.length < 16) {
    throw new Error('盐值长度至少 16 字节')
  }

  // Argon2id 派生 32 字节密钥
  const key = await argon2id({
    password,
    salt,
    parallelism: config.parallelism,
    iterations: config.iterations,
    memorySize: config.memKiB,
    hashLength: 32, // AES-256 需要 32 字节密钥
    outputType: 'binary',
  })

  return key
}

/**
 * 生成随机盐值
 *
 * @param length - 盐值长度（字节），默认 32
 * @returns 随机盐值
 */
export function generateSalt(length: number = 32): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}
