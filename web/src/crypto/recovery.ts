/**
 * 恢复码生成与验证
 *
 * 恢复码格式：XXXX-XXXX-XXXX-XXXX（4 组，每组 4 个字符）
 * 字符集：大写字母 + 数字，排除易混淆字符（0 O I 1 l）
 * 熵：32^16 ≈ 2^80（足够安全）
 */

// 字符集（排除 0 O I 1，共 32 个字符）
const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/**
 * 生成高熵随机恢复码
 *
 * @returns 恢复码，格式：XXXX-XXXX-XXXX-XXXX
 */
export function generateRecoveryCode(): string {
  const groups: string[] = []

  for (let i = 0; i < 4; i++) {
    let group = ''
    for (let j = 0; j < 4; j++) {
      const randomIndex = crypto.getRandomValues(new Uint8Array(1))[0] % CHARSET.length
      group += CHARSET[randomIndex]
    }
    groups.push(group)
  }

  return groups.join('-')
}

/**
 * 验证恢复码格式
 *
 * @param code - 恢复码
 * @returns 是否格式正确
 */
export function isValidRecoveryCode(code: string): boolean {
  // 格式：4 组，每组 4 个字符，用 - 分隔
  const pattern = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/
  return pattern.test(code)
}

/**
 * 标准化恢复码（转大写、去空格、保留分隔符）
 *
 * @param code - 用户输入的恢复码
 * @returns 标准化后的恢复码
 */
export function normalizeRecoveryCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/\s+/g, '') // 去除所有空格
    .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ-]/g, '') // 只保留字符集和分隔符
}
