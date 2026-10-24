import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  createTransactionScoped,
  listTransactionsScoped,
  monthlyTotalsScoped,
  summarizeTransactionsScoped,
  updateTransactionScoped
} from '../../../server/utils/transactions'
import { CategoryNotFound, CategoryRequired } from '../../../server/utils/errors'

// Mock the Prisma accessor so the scoped data-access runs against an
// in-memory fake. vi.hoisted gives the mock factory a stable handle it
// can read at call time; beforeEach swaps in a fresh fake per test.
const { dbRef } = vi.hoisted(() => ({ dbRef: { current: null as unknown } }))
vi.mock('../../../server/utils/db', () => ({
  getPrisma: () => dbRef.current as unknown as PrismaClient
}))

// A row shaped like what Prisma hands back from the income/expense
// tables — enough for toTransaction() to project it.
function makeRow(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    date: new Date('2024-01-15T00:00:00.000Z'),
    name: 'Coffee',
    amount: 42,
    currency: null,
    // A real, resolvable category by default (reads are strict now).
    category: 3,
    created_at: new Date(0),
    ...over
  }
}

// Label map the strict read projection resolves against. Covers the ids
// used across these tests; rows with an id outside this set (0, 99) are
// treated as unresolved and make toTransaction throw.
const LABELS = [
  { id: 3, label: 'Food' },
  { id: 4, label: 'Rent' },
  { id: 5, label: 'Salary' },
  { id: 8, label: 'Misc' }
]

// Minimal fake Prisma. Every method is a spy; category existence probes
// default to "not found" (findFirst → null) so tests opt into existence
// explicitly. create/update echo a complete row so toTransaction works,
// and the label findMany defaults to LABELS so strict reads resolve.
function makeDb() {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => makeRow(data))
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => makeRow(data))
  return {
    income: {
      create,
      update,
      delete: vi.fn(async () => makeRow()),
      findFirst: vi.fn(async () => null),
      aggregate: vi.fn(async () => ({ _sum: { amount: 0 }, _count: 0 })),
      groupBy: vi.fn(async (): Promise<{ date: Date, _sum: { amount: number | null } }[]> => [])
    },
    expense: {
      create,
      update,
      delete: vi.fn(async () => makeRow()),
      findFirst: vi.fn(async () => null),
      aggregate: vi.fn(async () => ({ _sum: { amount: 0 }, _count: 0 })),
      groupBy: vi.fn(async (): Promise<{ date: Date, _sum: { amount: number | null } }[]> => [])
    },
    expenseCategory: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async (): Promise<{ id: number, label: string }[]> => LABELS)
    },
    incomeCategory: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async (): Promise<{ id: number, label: string }[]> => LABELS)
    }
  }
}

let db: ReturnType<typeof makeDb>
beforeEach(() => {
  db = makeDb()
  dbRef.current = db
})

const base = { date: '2024-01-15', name: 'Coffee', amount: 42 }

describe('createTransactionScoped — category integrity', () => {
  it('rejects an unknown category id and never writes', async () => {
    db.expenseCategory.findFirst.mockResolvedValue(null)
    await expect(
      createTransactionScoped('u1', { ...base, type: 'expense', category: 99 })
    ).rejects.toBeInstanceOf(CategoryNotFound)
    expect(db.expense.create).not.toHaveBeenCalled()
  })

  it('rejects category 0 (uncategorised) on create — a real category is required', async () => {
    await expect(
      createTransactionScoped('u1', { ...base, type: 'expense', category: 0 })
    ).rejects.toBeInstanceOf(CategoryRequired)
    expect(db.expense.create).not.toHaveBeenCalled()
  })

  it('writes when the category exists for the resolved type', async () => {
    db.expenseCategory.findFirst.mockResolvedValue({ id: 3 })
    await createTransactionScoped('u1', { ...base, type: 'expense', category: 3 })
    expect(db.expense.create).toHaveBeenCalledOnce()
    expect(db.expense.create.mock.calls[0][0].data.category).toBe(3)
  })

  it('validates an income category against the income table', async () => {
    db.incomeCategory.findFirst.mockResolvedValue({ id: 5 })
    await createTransactionScoped('u1', { ...base, type: 'income', category: 5 })
    expect(db.incomeCategory.findFirst).toHaveBeenCalledOnce()
    expect(db.income.create).toHaveBeenCalledOnce()
  })
})

describe('createTransactionScoped — currency default', () => {
  it('defaults to CZK when no currency is supplied', async () => {
    db.expenseCategory.findFirst.mockResolvedValue({ id: 3 })
    await createTransactionScoped('u1', { ...base, type: 'expense', category: 3 })
    expect(db.expense.create.mock.calls[0][0].data.currency).toBe('CZK')
  })

  it('keeps an explicitly supplied currency', async () => {
    db.expenseCategory.findFirst.mockResolvedValue({ id: 3 })
    await createTransactionScoped('u1', { ...base, type: 'expense', category: 3, currency: 'USD' })
    expect(db.expense.create.mock.calls[0][0].data.currency).toBe('USD')
  })
})

describe('updateTransactionScoped — category integrity', () => {
  it('rejects a category id that is valid for the old type but not the new one after a type change', async () => {
    // Existing row is an income; category 5 exists as an income category.
    db.income.findFirst.mockResolvedValue(makeRow({ category: 5 }))
    db.incomeCategory.findFirst.mockResolvedValue({ id: 5 })
    // After switching to expense, 5 must exist as an EXPENSE category —
    // it doesn't, so the write is rejected.
    db.expenseCategory.findFirst.mockResolvedValue(null)

    await expect(
      updateTransactionScoped('u1', 7, { type: 'expense' })
    ).rejects.toBeInstanceOf(CategoryNotFound)
    expect(db.expense.create).not.toHaveBeenCalled()
    expect(db.income.delete).not.toHaveBeenCalled()
  })

  it('moves the row when the carried-over category also exists for the new type', async () => {
    db.income.findFirst.mockResolvedValue(makeRow({ category: 5 }))
    db.expenseCategory.findFirst.mockResolvedValue({ id: 5 })

    await updateTransactionScoped('u1', 7, { type: 'expense' })
    expect(db.income.delete).toHaveBeenCalledOnce()
    expect(db.expense.create).toHaveBeenCalledOnce()
    expect(db.expense.create.mock.calls[0][0].data.category).toBe(5)
  })

  it('rejects an unknown category on an in-place update', async () => {
    db.expense.findFirst.mockResolvedValue(makeRow({ category: 0 }))
    db.expenseCategory.findFirst.mockResolvedValue(null)
    await expect(
      updateTransactionScoped('u1', 7, { category: 99 })
    ).rejects.toBeInstanceOf(CategoryNotFound)
    expect(db.expense.update).not.toHaveBeenCalled()
  })

  it('rejects category 0 on an in-place update (no uncategorised)', async () => {
    db.expense.findFirst.mockResolvedValue(makeRow({ category: 4 }))
    await expect(
      updateTransactionScoped('u1', 7, { category: 0 })
    ).rejects.toBeInstanceOf(CategoryNotFound)
    expect(db.expense.update).not.toHaveBeenCalled()
  })

  it('skips the category probe on a no-op update (no category, no type change)', async () => {
    db.expense.findFirst.mockResolvedValue(makeRow({ category: 4 }))
    await updateTransactionScoped('u1', 7, { name: 'Tea' })
    expect(db.expenseCategory.findFirst).not.toHaveBeenCalled()
    expect(db.expense.update).toHaveBeenCalledOnce()
  })

  it('writes when the new category exists for the unchanged type', async () => {
    db.expense.findFirst.mockResolvedValue(makeRow({ category: 0 }))
    db.expenseCategory.findFirst.mockResolvedValue({ id: 8 })
    await updateTransactionScoped('u1', 7, { category: 8 })
    expect(db.expense.update).toHaveBeenCalledOnce()
    expect(db.expense.update.mock.calls[0][0].data.category).toBe(8)
  })
})

describe('summarizeTransactionsScoped', () => {
  it('sums both tables and nets them when no type filter is set', async () => {
    db.income.aggregate = vi.fn(async () => ({ _sum: { amount: 1000 }, _count: 3 }))
    db.expense.aggregate = vi.fn(async () => ({ _sum: { amount: 400 }, _count: 5 }))
    const summary = await summarizeTransactionsScoped('u1', {})
    expect(summary).toEqual({
      income: 1000, expenses: 400, net: 600, incomeCount: 3, expenseCount: 5
    })
  })

  it('aggregates only income when type=income (expense table untouched)', async () => {
    db.income.aggregate = vi.fn(async () => ({ _sum: { amount: 1000 }, _count: 3 }))
    const summary = await summarizeTransactionsScoped('u1', { type: 'income' })
    expect(summary).toEqual({
      income: 1000, expenses: 0, net: 1000, incomeCount: 3, expenseCount: 0
    })
    expect(db.expense.aggregate).not.toHaveBeenCalled()
  })

  it('aggregates only expense when type=expense (income table untouched)', async () => {
    db.expense.aggregate = vi.fn(async () => ({ _sum: { amount: 400 }, _count: 5 }))
    const summary = await summarizeTransactionsScoped('u1', { type: 'expense' })
    expect(summary).toEqual({
      income: 0, expenses: 400, net: -400, incomeCount: 0, expenseCount: 5
    })
    expect(db.income.aggregate).not.toHaveBeenCalled()
  })

  it('treats a null sum (no matching rows) as zero', async () => {
    db.income.aggregate = vi.fn(async () => ({ _sum: { amount: null }, _count: 0 }))
    db.expense.aggregate = vi.fn(async () => ({ _sum: { amount: null }, _count: 0 }))
    const summary = await summarizeTransactionsScoped('u1', {})
    expect(summary).toEqual({
      income: 0, expenses: 0, net: 0, incomeCount: 0, expenseCount: 0
    })
  })

  it('scopes the aggregate to the viewer and the inclusive date range', async () => {
    await summarizeTransactionsScoped('u1', { dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    const where = db.income.aggregate.mock.calls[0][0].where
    expect(where.user_id).toBe('u1')
    expect(where.date.gte).toEqual(new Date('2024-01-01T00:00:00.000Z'))
    expect(where.date.lte).toEqual(new Date('2024-01-31T23:59:59.999Z'))
  })
})

describe('monthlyTotalsScoped', () => {
  const day = (date: string, amount: number | null) => ({ date: new Date(`${date}T00:00:00.000Z`), _sum: { amount } })

  it('folds daily sums into zero-filled months, oldest first', async () => {
    db.income.groupBy = vi.fn(async () => [day('2026-08-10', 68000), day('2026-10-10', 68000), day('2026-10-31', 312.5)])
    db.expense.groupBy = vi.fn(async () => [day('2026-08-01', 16900), day('2026-08-20', 0.1), day('2026-08-21', 0.2)])
    const months = await monthlyTotalsScoped('u1', '2026-08', '2026-10')
    expect(months).toEqual([
      { month: '2026-08', income: 68000, expenses: 16900.3 },
      { month: '2026-09', income: 0, expenses: 0 },
      { month: '2026-10', income: 68312.5, expenses: 0 }
    ])
  })

  it('treats a null daily sum as zero', async () => {
    db.expense.groupBy = vi.fn(async () => [day('2026-10-01', null)])
    const months = await monthlyTotalsScoped('u1', '2026-10', '2026-10')
    expect(months).toEqual([{ month: '2026-10', income: 0, expenses: 0 }])
  })

  it('groups by day within the viewer and the whole months asked for', async () => {
    await monthlyTotalsScoped('u1', '2025-11', '2026-10')
    const args = db.expense.groupBy.mock.calls[0]![0] as unknown as { by: string[], where: { user_id: string, date: { gte: Date, lte: Date } } }
    expect(args.by).toEqual(['date'])
    expect(args.where.user_id).toBe('u1')
    expect(args.where.date.gte).toEqual(new Date('2025-11-01T00:00:00.000Z'))
    expect(args.where.date.lte).toEqual(new Date('2026-10-31T23:59:59.999Z'))
  })
})

describe('category join — reads return { id, label }', () => {
  it('lists with the expense category label resolved from its table', async () => {
    db.expense.findMany = vi.fn(async () => [makeRow({ id: 7, category: 3 })])
    db.expenseCategory.findMany.mockResolvedValue([{ id: 3, label: 'Food' }])
    const items = await listTransactionsScoped('u1', { type: 'expense' })
    expect(items[0]!.category).toEqual({ id: 3, label: 'Food' })
  })

  it('returns the id + label on create', async () => {
    db.expenseCategory.findFirst.mockResolvedValue({ id: 3 })
    db.expenseCategory.findMany.mockResolvedValue([{ id: 3, label: 'Food' }])
    const item = await createTransactionScoped('u1', { ...base, type: 'expense', category: 3 })
    expect(item.category).toEqual({ id: 3, label: 'Food' })
  })

  it('reads strictly — a row whose category cannot be resolved (id 0) errors', async () => {
    db.expense.findMany = vi.fn(async () => [makeRow({ id: 7, category: 0 })])
    await expect(listTransactionsScoped('u1', { type: 'expense' }))
      .rejects.toBeInstanceOf(CategoryNotFound)
  })

  it('reads strictly — a deleted / unknown category id errors (no empty-label placeholder)', async () => {
    db.expense.findMany = vi.fn(async () => [makeRow({ id: 7, category: 99 })])
    await expect(listTransactionsScoped('u1', { type: 'expense' }))
      .rejects.toBeInstanceOf(CategoryNotFound)
  })
})
