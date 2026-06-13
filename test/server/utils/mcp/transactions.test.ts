import { describe, it, expect } from 'vitest'
import { toCategoryId } from '../../../../server/utils/mcp/transactions'
import { InvalidCategoryInput } from '../../../../server/utils/errors'

describe('toCategoryId — MCP boundary coercion', () => {
  it('maps omitted/empty input to undefined (caller treats as uncategorised)', () => {
    expect(toCategoryId(undefined)).toBeUndefined()
    expect(toCategoryId('')).toBeUndefined()
    expect(toCategoryId('   ')).toBeUndefined()
  })

  it('passes through a valid integer id', () => {
    expect(toCategoryId(5)).toBe(5)
    expect(toCategoryId(0)).toBe(0)
    expect(toCategoryId('12')).toBe(12)
  })

  it('rejects a non-numeric string (e.g. a category name) instead of coercing to 0', () => {
    expect(() => toCategoryId('Food')).toThrow(InvalidCategoryInput)
    expect(() => toCategoryId('3.5')).toThrow(InvalidCategoryInput)
    expect(() => toCategoryId('-1')).toThrow(InvalidCategoryInput)
  })

  it('rejects a negative or non-integer number', () => {
    expect(() => toCategoryId(-1)).toThrow(InvalidCategoryInput)
    expect(() => toCategoryId(2.5)).toThrow(InvalidCategoryInput)
  })
})
