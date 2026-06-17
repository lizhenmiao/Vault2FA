import type { EncryptedVault } from '@/crypto/types'
import type { RemoteData } from './types'

/**
 * 查询后端是否已存在 vault（不需要鉴权）
 *
 * 前端用它决定全新浏览器该显示「创建保险库」还是「解锁」页面。
 *
 * @returns 后端是否已有 vault；后端不可达时返回 null（调用方据此回退到本地缓存判断）
 */
/**
 * 查询远程是否有 vault（单用户模式）
 *
 * @returns { exists: boolean } 或 null（后端不可达）
 */
export async function fetchVaultExists(): Promise<{ exists: boolean } | null> {
  try {
    const response = await fetch('/api/vault/exists', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return { exists: data.exists === true }
  } catch (error) {
    // 后端不可达（如纯前端调试、离线）：返回 null，由调用方回退
    console.warn('查询 vault 是否存在失败（后端不可达）:', error)
    return null
  }
}

/**
 * 从远程拉取 vault（通过后端 API）
 *
 * @param loginHash - 登录哈希（后端用它鉴权，由登录密码派生，无法反推加密密钥）
 * @returns 远程 vault 和版本号，如果不存在返回 null
 */
export async function pullVault(loginHash: string): Promise<RemoteData | null> {
  try {
    const response = await fetch('/api/vault', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginHash}`,
      },
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '拉取失败')
    }

    const data = await response.json()
    // 后端返回 { vault: EncryptedVault对象, version: string }
    return {
      vault: data.vault,  // 直接使用对象，不需要 JSON.parse
      version: data.version,
    }
  } catch (error) {
    console.error('拉取失败:', error)
    throw error
  }
}

/**
 * 推送 vault 到远程（通过后端 API）
 *
 * @param vault - 加密的 vault
 * @param loginHash - 登录哈希（后端用它鉴权）
 * @param expectedVersion - 期望的版本号（用于乐观锁）
 * @returns 新的版本号
 */
export async function pushVault(
  vault: EncryptedVault,
  loginHash: string,
  expectedVersion: string | null
): Promise<string> {
  try {
    const response = await fetch('/api/vault', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginHash}`,
      },
      body: JSON.stringify({
        vault,  // 直接发送对象，不要 JSON.stringify
        version: expectedVersion,  // 字段名改为 version
      }),
    })

    if (!response.ok) {
      const error = await response.json()

      // 冲突错误
      if (response.status === 409) {
        throw new Error('版本冲突，请先拉取最新数据')
      }

      throw new Error(error.error || '推送失败')
    }

    const data = await response.json()
    return data.version
  } catch (error) {
    console.error('推送失败:', error)
    throw error
  }
}
