import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { updateExpenseCategoryScoped } from '../../../server/utils/expense-categories'
import { updateIncomeCategoryScoped } from '../../../server/utils/income-categories'
import { ExpenseCategoryNotFound, IncomeCategoryNotFound } from '../../../server/utils/errors'

// The default category: at most one per user and kind, switched in one
// transaction, and never cleared by a request for somebody else's id.
const { dbRef } = vi.hoisted(() => ({ dbRef: { current: null as unknown } }))
vi.mock('../../../server/utils/db', () => ({
  getPrisma: () => dbRef.current as unknown as PrismaClient
}))

function table(owned: number[]) {
  return {
    // The ownership probe: where { id, user_id }.
    findFirst: vi.fn(async ({ where }: { where: { id: number } }) => (owned.includes(where.id) ? { id: where.id } : null)),
    updateMany: vi.fn(async ({ where }: { where: { id?: number } }) => ({
      count: where.id === undefined || owned.includes(where.id) ? 1 : 0
    })),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: number } }) => ({
      id: where.id, label: 'Groceries', percent: 30, color: 'emerald', position: 0, is_default: true, created_at: new Date(0)
    }))
  }
}

function makeDb() {
  return {
    expenseCategory: table([3, 4]),
    incomeCategory: table([5]),
    // Array form: the operations are already built; run them.
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
  }
}

let db: ReturnType<typeof makeDb>
beforeEach(() => {
  db = makeDb()
  dbRef.current = db
})

describe('making a category the default', () => {
  it('takes the mark off the old one in the same transaction', async () => {
    const category = await updateExpenseCategoryScoped('u1', 4, { is_default: true })
    expect(db.$transaction).toHaveBeenCalledOnce()
    const calls = db.expenseCategory.updateMany.mock.calls.map(c => c[0])
    expect(calls).toContainEqual({
      where: { user_id: 'u1', is_default: true, NOT: { id: 4 } },
      data: { is_default: false }
    })
    expect(calls).toContainEqual({ where: { id: 4, user_id: 'u1' }, data: { is_default: true } })
    expect(category.is_default).toBe(true)
  })

  it('works the same for income', async () => {
    await updateIncomeCategoryScoped('u1', 5, { is_default: true })
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(db.incomeCategory.updateMany.mock.calls.map(c => c[0])).toContainEqual({
      where: { user_id: 'u1', is_default: true, NOT: { id: 5 } },
      data: { is_default: false }
    })
  })

  it("leaves the user's default alone for an id that is not theirs", async () => {
    await expect(updateExpenseCategoryScoped('u1', 99, { is_default: true }))
      .rejects.toBeInstanceOf(ExpenseCategoryNotFound)
    await expect(updateIncomeCategoryScoped('u1', 99, { is_default: true }))
      .rejects.toBeInstanceOf(IncomeCategoryNotFound)
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.expenseCategory.updateMany).not.toHaveBeenCalled()
    expect(db.incomeCategory.updateMany).not.toHaveBeenCalled()
  })

  it('unsetting it touches only that category', async () => {
    await updateExpenseCategoryScoped('u1', 4, { is_default: false })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.expenseCategory.updateMany.mock.calls.map(c => c[0]))
      .toEqual([{ where: { id: 4, user_id: 'u1' }, data: { is_default: false } }])
  })
})
