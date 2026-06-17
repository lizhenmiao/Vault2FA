import { describe, it, expect } from 'vitest'
import {
  generateUUID,
  createAccountFromParsed,
  softDeleteAccount,
  updateAccount,
  filterActiveAccounts,
  sortAccounts,
  searchAccounts,
} from '../utils'
import type { Account, ParsedOTPAuthURI } from '../types'

describe('UUID 生成', () => {
  it('应该生成有效的 UUID', () => {
    const uuid = generateUUID()

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('每次生成的 UUID 应该不同', () => {
    const uuid1 = generateUUID()
    const uuid2 = generateUUID()

    expect(uuid1).not.toBe(uuid2)
  })
})

describe('从解析数据创建账户', () => {
  it('应该创建完整的账户对象', () => {
    const parsed: ParsedOTPAuthURI = {
      issuer: 'GitHub',
      label: 'user@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
    }

    const account = createAccountFromParsed(parsed)

    expect(account.id).toBeTruthy()
    expect(account.issuer).toBe(parsed.issuer)
    expect(account.label).toBe(parsed.label)
    expect(account.secret).toBe(parsed.secret)
    expect(account.algorithm).toBe(parsed.algorithm)
    expect(account.digits).toBe(parsed.digits)
    expect(account.period).toBe(parsed.period)
    expect(account.type).toBe(parsed.type)
    expect(account.createdAt).toBeTruthy()
    expect(account.updatedAt).toBeTruthy()
    expect(account.deletedAt).toBeNull()
  })

  it('createdAt 和 updatedAt 应该相同', () => {
    const parsed: ParsedOTPAuthURI = {
      issuer: 'Test',
      label: 'test',
      secret: 'SECRET',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
    }

    const account = createAccountFromParsed(parsed)

    expect(account.createdAt).toBe(account.updatedAt)
  })
})

describe('软删除账户', () => {
  const testAccount: Account = {
    id: '1',
    issuer: 'Test',
    label: 'test',
    secret: 'SECRET',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    type: 'totp',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
  }

  it('应该设置 deletedAt 时间戳', () => {
    const deleted = softDeleteAccount(testAccount)

    expect(deleted.deletedAt).toBeTruthy()
    expect(deleted.deletedAt).not.toBeNull()
  })

  it('应该更新 updatedAt', () => {
    const deleted = softDeleteAccount(testAccount)

    expect(new Date(deleted.updatedAt).getTime()).toBeGreaterThan(
      new Date(testAccount.updatedAt).getTime()
    )
  })

  it('其他字段应该保持不变', () => {
    const deleted = softDeleteAccount(testAccount)

    expect(deleted.id).toBe(testAccount.id)
    expect(deleted.issuer).toBe(testAccount.issuer)
    expect(deleted.label).toBe(testAccount.label)
  })
})

describe('更新账户', () => {
  const testAccount: Account = {
    id: '1',
    issuer: 'Test',
    label: 'test',
    secret: 'SECRET',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    type: 'totp',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
  }

  it('应该更新指定的字段', () => {
    const updated = updateAccount(testAccount, {
      issuer: 'New Issuer',
      label: 'new@example.com',
    })

    expect(updated.issuer).toBe('New Issuer')
    expect(updated.label).toBe('new@example.com')
  })

  it('应该更新 updatedAt', () => {
    const updated = updateAccount(testAccount, { issuer: 'New' })

    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(testAccount.updatedAt).getTime()
    )
  })

  it('未更新的字段应该保持不变', () => {
    const updated = updateAccount(testAccount, { issuer: 'New' })

    expect(updated.id).toBe(testAccount.id)
    expect(updated.label).toBe(testAccount.label)
    expect(updated.secret).toBe(testAccount.secret)
  })
})

describe('过滤活跃账户', () => {
  const accounts: Account[] = [
    {
      id: '1',
      issuer: 'Active1',
      label: 'active1',
      secret: 'SECRET1',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
    {
      id: '2',
      issuer: 'Deleted',
      label: 'deleted',
      secret: 'SECRET2',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: '3',
      issuer: 'Active2',
      label: 'active2',
      secret: 'SECRET3',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
  ]

  it('应该只返回未删除的账户', () => {
    const active = filterActiveAccounts(accounts)

    expect(active.length).toBe(2)
    expect(active.every((a) => !a.deletedAt)).toBe(true)
  })

  it('应该过滤掉已删除的账户', () => {
    const active = filterActiveAccounts(accounts)

    expect(active.some((a) => a.issuer === 'Deleted')).toBe(false)
  })
})

describe('账户排序', () => {
  const accounts: Account[] = [
    {
      id: '1',
      issuer: 'GitHub',
      label: 'user2@example.com',
      secret: 'SECRET',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
    {
      id: '2',
      issuer: 'Amazon',
      label: 'user@example.com',
      secret: 'SECRET',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
    {
      id: '3',
      issuer: 'GitHub',
      label: 'user1@example.com',
      secret: 'SECRET',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
  ]

  it('应该按 issuer 排序', () => {
    const sorted = sortAccounts(accounts)

    expect(sorted[0].issuer).toBe('Amazon')
    expect(sorted[1].issuer).toBe('GitHub')
    expect(sorted[2].issuer).toBe('GitHub')
  })

  it('相同 issuer 应该按 label 排序', () => {
    const sorted = sortAccounts(accounts)
    const githubAccounts = sorted.filter((a) => a.issuer === 'GitHub')

    expect(githubAccounts[0].label).toBe('user1@example.com')
    expect(githubAccounts[1].label).toBe('user2@example.com')
  })

  it('不应该修改原数组', () => {
    const original = [...accounts]
    sortAccounts(accounts)

    expect(accounts).toEqual(original)
  })
})

describe('账户搜索', () => {
  const accounts: Account[] = [
    {
      id: '1',
      issuer: 'GitHub',
      label: 'user@example.com',
      secret: 'SECRET',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
    {
      id: '2',
      issuer: 'Amazon',
      label: 'user@amazon.com',
      secret: 'SECRET',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
    {
      id: '3',
      issuer: 'Google',
      label: 'test@gmail.com',
      secret: 'SECRET',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      type: 'totp',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
  ]

  it('应该通过 issuer 搜索', () => {
    const results = searchAccounts(accounts, 'GitHub')

    expect(results.length).toBe(1)
    expect(results[0].issuer).toBe('GitHub')
  })

  it('应该通过 label 搜索', () => {
    const results = searchAccounts(accounts, 'amazon.com')

    expect(results.length).toBe(1)
    expect(results[0].label).toBe('user@amazon.com')
  })

  it('搜索应该不区分大小写', () => {
    const results = searchAccounts(accounts, 'github')

    expect(results.length).toBe(1)
    expect(results[0].issuer).toBe('GitHub')
  })

  it('空查询应该返回所有账户', () => {
    const results = searchAccounts(accounts, '')

    expect(results.length).toBe(accounts.length)
  })

  it('空格查询应该返回所有账户', () => {
    const results = searchAccounts(accounts, '   ')

    expect(results.length).toBe(accounts.length)
  })

  it('无匹配结果应该返回空数组', () => {
    const results = searchAccounts(accounts, 'nonexistent')

    expect(results.length).toBe(0)
  })
})
