import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 className 的工具函数。
 * - clsx 处理条件类名（对象 / 数组 / 假值过滤）
 * - twMerge 处理 Tailwind 冲突类名（后者覆盖前者，如 px-2 px-4 → px-4）
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
