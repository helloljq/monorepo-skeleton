import { describe, expect, it } from 'vitest'

import {
  EMAIL_REGEX,
  formatAmount,
  isEmpty,
  isValidEmail,
  isValidPhone,
  parseAmount,
  PHONE_REGEX,
  removeUndefined,
  safeJsonParse,
  sleep,
  uuid,
} from './index'

describe('PHONE_REGEX', () => {
  it('should match valid Chinese phone numbers', () => {
    expect(PHONE_REGEX.test('13800138000')).toBe(true)
    expect(PHONE_REGEX.test('15912345678')).toBe(true)
    expect(PHONE_REGEX.test('18888888888')).toBe(true)
  })

  it('should not match invalid phone numbers', () => {
    expect(PHONE_REGEX.test('12345678901')).toBe(false) // 不以 13-19 开头
    expect(PHONE_REGEX.test('1380013800')).toBe(false) // 少一位
    expect(PHONE_REGEX.test('138001380001')).toBe(false) // 多一位
    expect(PHONE_REGEX.test('abc')).toBe(false)
  })
})

describe('EMAIL_REGEX', () => {
  it('should match valid email addresses', () => {
    expect(EMAIL_REGEX.test('test@example.com')).toBe(true)
    expect(EMAIL_REGEX.test('user.name@domain.co')).toBe(true)
    expect(EMAIL_REGEX.test('a@b.c')).toBe(true)
  })

  it('should not match invalid email addresses', () => {
    expect(EMAIL_REGEX.test('invalid')).toBe(false)
    expect(EMAIL_REGEX.test('test@')).toBe(false)
    expect(EMAIL_REGEX.test('@domain.com')).toBe(false)
    expect(EMAIL_REGEX.test('test @example.com')).toBe(false) // 有空格
  })
})

describe('isValidPhone', () => {
  it('should return true for valid phone numbers', () => {
    expect(isValidPhone('13800138000')).toBe(true)
  })

  it('should return false for invalid phone numbers', () => {
    expect(isValidPhone('12345')).toBe(false)
    expect(isValidPhone('')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('formatAmount', () => {
  it('should convert cents to yuan with 2 decimal places by default', () => {
    expect(formatAmount(100)).toBe('1.00')
    expect(formatAmount(1234)).toBe('12.34')
    expect(formatAmount(0)).toBe('0.00')
    expect(formatAmount(99)).toBe('0.99')
  })

  it('should respect custom decimal places', () => {
    expect(formatAmount(1234, { decimals: 0 })).toBe('12')
    expect(formatAmount(1234, { decimals: 1 })).toBe('12.3')
    expect(formatAmount(1234, { decimals: 3 })).toBe('12.340')
  })
})

describe('parseAmount', () => {
  it('should convert yuan to cents', () => {
    expect(parseAmount(1)).toBe(100)
    expect(parseAmount(12.34)).toBe(1234)
    expect(parseAmount(0)).toBe(0)
    expect(parseAmount(0.99)).toBe(99)
  })

  it('should handle string input', () => {
    expect(parseAmount('1')).toBe(100)
    expect(parseAmount('12.34')).toBe(1234)
    expect(parseAmount('0.99')).toBe(99)
  })

  it('should round to avoid floating point issues', () => {
    expect(parseAmount(0.01)).toBe(1)
    expect(parseAmount(0.001)).toBe(0)
  })
})

describe('sleep', () => {
  it('should resolve after specified milliseconds', async () => {
    const start = Date.now()
    await sleep(50)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(45) // 允许一些误差
  })
})

describe('uuid', () => {
  it('should generate valid UUID v4 format', () => {
    const id = uuid()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(uuidRegex.test(id)).toBe(true)
  })

  it('should generate unique UUIDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid()))
    expect(ids.size).toBe(100)
  })
})

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"a": 1}', {})).toEqual({ a: 1 })
    expect(safeJsonParse('[1, 2, 3]', [])).toEqual([1, 2, 3])
    expect(safeJsonParse('"hello"', '')).toBe('hello')
  })

  it('should return fallback for invalid JSON', () => {
    expect(safeJsonParse('invalid', {})).toEqual({})
    expect(safeJsonParse('', [])).toEqual([])
    expect(safeJsonParse('{broken', null)).toBeNull()
  })
})

describe('isEmpty', () => {
  it('should return true for empty objects', () => {
    expect(isEmpty({})).toBe(true)
  })

  it('should return false for non-empty objects', () => {
    expect(isEmpty({ a: 1 })).toBe(false)
    expect(isEmpty({ a: undefined })).toBe(false) // key 存在
  })
})

describe('removeUndefined', () => {
  it('should remove undefined values', () => {
    expect(removeUndefined({ a: 1, b: undefined, c: 'hello' })).toEqual({
      a: 1,
      c: 'hello',
    })
  })

  it('should keep null values', () => {
    expect(removeUndefined({ a: null, b: undefined })).toEqual({ a: null })
  })

  it('should keep falsy values except undefined', () => {
    expect(removeUndefined({ a: 0, b: '', c: false, d: undefined })).toEqual({
      a: 0,
      b: '',
      c: false,
    })
  })

  it('should return empty object for all undefined', () => {
    expect(removeUndefined({ a: undefined, b: undefined })).toEqual({})
  })
})
