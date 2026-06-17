/**
 * 本地存储模块统一导出
 */

// IndexedDB 基础操作
export { openDB, getItem, setItem, removeItem, clearAll } from './db'

// Vault 专用操作
export { loadVault, saveVault, deleteVault, hasVault } from './vault'

// 本地偏好（localStorage）
export {
  getCachedUsername,
  setCachedUsername,
  clearCachedUsername,
  getLockTimeoutMinutes,
  setLockTimeoutMinutes,
} from './local'

// 会话密钥（sessionStorage，无感刷新用）
export type { SessionSnapshot } from './session'
export {
  saveSessionSnapshot,
  takeSessionSnapshot,
  clearSessionSnapshot,
} from './session'
