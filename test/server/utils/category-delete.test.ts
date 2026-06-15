import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { deleteExpenseCategoryScoped } from '../../../server/utils/expense-categories'
import { deleteIncomeCategoryScoped } from '../../../server/utils/income-categories'
import { CategoryInUse, ExpenseCategoryNotFound } from '../../../server/utils/errors'

// Strict reads require every transaction's category to resolve, so a
// category can't be deleted while transactions still reference it.
const { dbRef } = vi.hoisted(() => ({ dbRef: { current: null as unknown } }))
vi.mock('../../../server/utils/db', () => ({
  getPrisma: () => dbRef.current as unknown as PrismaClient
}))

function makeDb() {
  return {
    expense: { count: vi.fn(async () => 0) },
    income: { count: vi.fn(async () => 0) },
    expenseCategory: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    incomeCategory: { deleteMany: vi.fn(async () => ({ count: 1 })) }
  }
}

let db: ReturnType<typeof makeDb>
beforeEach(() => {
  db = makeDb()
  dbRef.current = db
})

describe('deleteExpenseCategoryScoped — in-use guard', () => {
  it('refuses when expense transactions still reference the category', async () => {
    db.expense.count.mockResolvedValue(2)
    await expect(deleteExpenseCategoryScoped('u1', 3)).rejects.toBeInstanceOf(CategoryInUse)
    expect(db.expenseCategory.deleteMany).not.toHaveBeenCalled()
  })

  it('deletes when nothing references it', async () => {
    db.expense.count.mockResolvedValue(0)
    await expect(deleteExpenseCategoryScoped('u1', 3)).resolves.toEqual({ deleted: 3 })
  })

  it('throws ExpenseCategoryNotFound when no row matched', async () => {
    db.expense.count.mockResolvedValue(0)
    db.expenseCategory.deleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteExpenseCategoryScoped('u1', 999)).rejects.toBeInstanceOf(ExpenseCategoryNotFound)
  })
})

describe('deleteIncomeCategoryScoped — in-use guard', () => {
  it('refuses when income transactions still reference the category', async () => {
    db.income.count.mockResolvedValue(1)
    await expect(deleteIncomeCategoryScoped('u1', 5)).rejects.toBeInstanceOf(CategoryInUse)
    expect(db.incomeCategory.deleteMany).not.toHaveBeenCalled()
  })

  it('deletes when nothing references it', async () => {
    db.income.count.mockResolvedValue(0)
    await expect(deleteIncomeCategoryScoped('u1', 5)).resolves.toEqual({ deleted: 5 })
  })
})
