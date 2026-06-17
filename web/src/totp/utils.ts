import type { Account, ParsedOTPAuthURI } from './types'

/**
 * 生成 UUID v4
 *
 * @returns UUID 字符串
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}

/**
 * 从解析的 URI 数据创建账户对象
 *
 * @param parsed - 解析后的 otpauth URI 数据
 * @returns 新账户对象
 */
export function createAccountFromParsed(parsed: ParsedOTPAuthURI): Account {
  const now = new Date().toISOString()

  return {
    id: generateUUID(),
    issuer: parsed.issuer,
    label: parsed.label,
    secret: parsed.secret,
    algorithm: parsed.algorithm,
    digits: parsed.digits,
    period: parsed.period,
    type: parsed.type,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

/**
 * 软删除账户（设置 deletedAt）
 *
 * @param account - 账户对象
 * @returns 更新后的账户对象
 */
export function softDeleteAccount(account: Account): Account {
  return {
    ...account,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 更新账户信息
 *
 * @param account - 原账户对象
 * @param updates - 要更新的字段
 * @returns 更新后的账户对象
 */
export function updateAccount(
  account: Account,
  updates: Partial<Pick<Account, 'issuer' | 'label' | 'secret' | 'algorithm' | 'digits' | 'period'>>
): Account {
  return {
    ...account,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 过滤已删除的账户
 *
 * @param accounts - 账户列表
 * @returns 未删除的账户列表
 */
export function filterActiveAccounts(accounts: Account[]): Account[] {
  return accounts.filter((account) => !account.deletedAt)
}

/**
 * 按 issuer 和 label 排序账户
 *
 * @param accounts - 账户列表
 * @returns 排序后的账户列表
 */
export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    // 先按 issuer 排序
    const issuerCompare = a.issuer.localeCompare(b.issuer)
    if (issuerCompare !== 0) {
      return issuerCompare
    }
    // issuer 相同则按 label 排序
    return a.label.localeCompare(b.label)
  })
}

/**
 * 搜索账户（模糊匹配 issuer 或 label）
 *
 * @param accounts - 账户列表
 * @param query - 搜索关键词
 * @returns 匹配的账户列表
 */
export function searchAccounts(accounts: Account[], query: string): Account[] {
  if (!query.trim()) {
    return accounts
  }

  const lowerQuery = query.toLowerCase()
  return accounts.filter(
    (account) =>
      account.issuer.toLowerCase().includes(lowerQuery) ||
      account.label.toLowerCase().includes(lowerQuery)
  )
}
