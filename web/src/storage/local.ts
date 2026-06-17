/**
 * 本地偏好存储（localStorage）
 *
 * 存储非敏感的偏好设置：
 *   - 缓存用户名（锁定时保留，退出时清除）
 *   - 锁定时长配置（默认 5 分钟）
 */

const KEY_USERNAME = '2fa-cached-username'
const KEY_LOCK_TIMEOUT = '2fa-lock-timeout-minutes'

/**
 * 获取缓存的用户名
 *
 * @returns 用户名；未缓存时返回 null
 */
export function getCachedUsername(): string | null {
  return localStorage.getItem(KEY_USERNAME)
}

/**
 * 缓存用户名（登录成功后调用）
 *
 * @param username - 用户名
 */
export function setCachedUsername(username: string): void {
  localStorage.setItem(KEY_USERNAME, username)
}

/**
 * 清除缓存的用户名（退出时调用）
 */
export function clearCachedUsername(): void {
  localStorage.removeItem(KEY_USERNAME)
}

/**
 * 获取锁定时长配置（分钟）
 *
 * @returns 锁定时长（分钟），默认 5
 */
export function getLockTimeoutMinutes(): number {
  const stored = localStorage.getItem(KEY_LOCK_TIMEOUT)
  if (stored) {
    const parsed = parseInt(stored, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return 5 // 默认 5 分钟
}

/**
 * 设置锁定时长配置（分钟）
 *
 * @param minutes - 锁定时长（分钟，必须 > 0）
 */
export function setLockTimeoutMinutes(minutes: number): void {
  if (minutes <= 0) {
    throw new Error('锁定时长必须大于 0')
  }
  localStorage.setItem(KEY_LOCK_TIMEOUT, minutes.toString())
}
