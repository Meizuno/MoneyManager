import { describe, it, expect } from 'vitest'
import {
  INVALID_CATEGORY_ID,
  parseCategoryId,
  createTransactionSchema,
  updateTransactionSchema
} from '../../../shared/schemas/transaction'

// The one boundary, tested once for both surfaces: REST (categorySchema)
// and MCP (toCategoryId) both delegate to parseCategoryId.
describe('parseCategoryId', () => {
  it('treats omitted / empty / whitespace as uncategorised (undefined)', () => {
    expect(parseCategoryId(undefined)).toBeUndefined()
    expect(parseCategoryId('')).toBeUndefined()
    expect(parseCategoryId('   ')).toBeUndefined()
  })

  it('accepts a non-negative integer or numeric string', () => {
    expect(parseCategoryId(0)).toBe(0)
    expect(parseCategoryId(3)).toBe(3)
    expect(parseCategoryId('0')).toBe(0)
    expect(parseCategoryId('12')).toBe(12)
  })

  it('rejects a category name, negative, or non-integer', () => {
    expect(parseCategoryId('Food')).toBe(INVALID_CATEGORY_ID)
    expect(parseCategoryId('12abc')).toBe(INVALID_CATEGORY_ID)
    expect(parseCategoryId('3.5')).toBe(INVALID_CATEGORY_ID)
    expect(parseCategoryId('-1')).toBe(INVALID_CATEGORY_ID)
    expect(parseCategoryId(-1)).toBe(INVALID_CATEGORY_ID)
    expect(parseCategoryId(2.5)).toBe(INVALID_CATEGORY_ID)
  })
})

// The REST input boundary. A failed safeParse is exactly what makes
// POST/PUT /api/transactions return 400.
const base = { date: '2024-01-15', name: 'Coffee', amount: 10 }

describe('createTransactionSchema — category input', () => {
  it('rejects a non-numeric category name (400, not a silent uncategorised write)', () => {
    const r = createTransactionSchema.safeParse({ ...base, category: 'Food' })
    expect(r.success).toBe(false)
  })

  it('rejects a negative / non-integer category', () => {
    expect(createTransactionSchema.safeParse({ ...base, category: -1 }).success).toBe(false)
    expect(createTransactionSchema.safeParse({ ...base, category: 2.5 }).success).toBe(false)
  })

  it('requires a category — omitted or empty fails', () => {
    expect(createTransactionSchema.safeParse({ ...base }).success).toBe(false)
    expect(createTransactionSchema.safeParse({ ...base, category: '' }).success).toBe(false)
  })

  it('accepts the numeric ids the client form sends (string or number)', () => {
    const asString = createTransactionSchema.safeParse({ ...base, category: '3' })
    expect(asString.success && asString.data.category).toBe(3)

    const asNumber = createTransactionSchema.safeParse({ ...base, category: 3 })
    expect(asNumber.success && asNumber.data.category).toBe(3)
  })
})

describe('updateTransactionSchema — category input (partial)', () => {
  it('rejects a non-numeric category but allows it to be omitted or empty', () => {
    expect(updateTransactionSchema.safeParse({ category: 'Food' }).success).toBe(false)
    // Unlike create, update never requires a category.
    expect(updateTransactionSchema.safeParse({ name: 'Tea' }).success).toBe(true)
    expect(updateTransactionSchema.safeParse({ category: '' }).success).toBe(true)
  })
})
