/**
 * 会话密钥临时存储（sessionStorage）
 *
 * 用途：实现「无感刷新」——解锁后把会话密钥存入 sessionStorage，
 * 刷新页面时从中恢复登录态，无需重新输入密码。
 *
 * 安全设计：
 *   - sessionStorage 关闭标签页/浏览器自动清空（比 localStorage 安全）
 *   - 恢复时「读取后立即清除」，密钥只在「解锁→刷新→恢复」窗口内短暂存在
 *   - 锁定/退出/自动锁定时也主动清除（防御性双保险）
 *
 * 权衡：密钥短暂落盘到 sessionStorage，安全性略低于纯内存，
 * 但换取刷新无感体验（Bitwarden 网页版等的常见取舍）。
 */

const KEY_SESSION = '2fa-session-key'

/**
 * 会话密钥快照（存入 sessionStorage 的结构）
 */
export interface SessionSnapshot {
  username: string // 用户名
  encryptionKey: string // Base64 编码的加密密钥
  loginHash: string // 登录哈希
}

/**
 * 保存会话密钥到 sessionStorage（解锁/登录/创建成功后调用）
 *
 * @param snapshot - 会话密钥快照
 */
export function saveSessionSnapshot(snapshot: SessionSnapshot): void {
  try {
    sessionStorage.setItem(KEY_SESSION, JSON.stringify(snapshot))
  } catch (error) {
    console.warn('保存会话密钥失败:', error)
  }
}

/**
 * 读取并立即清除会话密钥（刷新恢复时调用）
 *
 * 无论恢复成功与否，读取后立即删除，确保密钥只用一次。
 *
 * @returns 会话密钥快照；不存在或解析失败返回 null
 */
export function takeSessionSnapshot(): SessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY_SESSION)
    // 读取后立即清除（无论后续恢复是否成功）
    sessionStorage.removeItem(KEY_SESSION)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as SessionSnapshot
    if (!parsed.username || !parsed.encryptionKey || !parsed.loginHash) {
      return null
    }
    return parsed
  } catch (error) {
    console.warn('读取会话密钥失败:', error)
    // 出错也要确保清除
    try {
      sessionStorage.removeItem(KEY_SESSION)
    } catch {
      // 忽略
    }
    return null
  }
}

/**
 * 清除会话密钥（锁定/退出/自动锁定时调用）
 */
export function clearSessionSnapshot(): void {
  try {
    sessionStorage.removeItem(KEY_SESSION)
  } catch (error) {
    console.warn('清除会话密钥失败:', error)
  }
}
