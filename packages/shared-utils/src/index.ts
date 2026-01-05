/**
 * 共享工具函数
 * 用于前后端共享的通用工具
 */

// 手机号校验正则
export const PHONE_REGEX = /^1[3-9]\d{9}$/

// 邮箱校验正则
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 校验手机号格式
 */
export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone)
}

/**
 * 校验邮箱格式
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

/**
 * 格式化金额（分 -> 元）
 */
export function formatAmount(cents: number, options?: { decimals?: number }): string {
  const { decimals = 2 } = options || {}
  return (cents / 100).toFixed(decimals)
}

/**
 * 解析金额（元 -> 分）
 */
export function parseAmount(yuan: string | number): number {
  const num = typeof yuan === 'string' ? parseFloat(yuan) : yuan
  return Math.round(num * 100)
}

/**
 * 延时函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 生成 UUID v4
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 安全解析 JSON
 */
export function safeJsonParse<T = unknown>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * 对象是否为空
 */
export function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0
}

/**
 * 移除对象中的 undefined 值
 */
export function removeUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>
}
