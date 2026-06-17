import type { EncryptedVault } from '@/crypto/types'
import { getItem, setItem, removeItem } from './db'

/**
 * IndexedDB 中存储的键
 */
const VAULT_KEY = 'encrypted-vault'

/**
 * 从 IndexedDB 读取加密的 vault
 *
 * @returns 加密的 vault，如果不存在返回 null
 */
export async function loadVault(): Promise<EncryptedVault | null> {
  try {
    return await getItem<EncryptedVault>(VAULT_KEY)
  } catch (error) {
    console.error('从 IndexedDB 读取 vault 失败:', error)
    return null
  }
}

/**
 * 将加密的 vault 保存到 IndexedDB
 *
 * @param vault - 加密的 vault
 */
export async function saveVault(vault: EncryptedVault): Promise<void> {
  try {
    await setItem(VAULT_KEY, vault)
  } catch (error) {
    console.error('保存 vault 到 IndexedDB 失败:', error)
    throw new Error('保存失败')
  }
}

/**
 * 从 IndexedDB 删除 vault（用于退出登录或重置）
 */
export async function deleteVault(): Promise<void> {
  try {
    await removeItem(VAULT_KEY)
  } catch (error) {
    console.error('删除 vault 失败:', error)
    throw new Error('删除失败')
  }
}

/**
 * 检查 IndexedDB 中是否存在 vault
 *
 * @returns 是否存在
 */
export async function hasVault(): Promise<boolean> {
  const vault = await loadVault()
  return vault !== null
}
