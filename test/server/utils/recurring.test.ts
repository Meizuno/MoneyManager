import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  createRecurringScoped,
  deleteRecurringScoped,
  materializeDue,
  updateRecurringScoped
} from '../../../server/utils/recurring'
import { CategoryRequired, RecurringNotFound } from '../../../server/utils/errors'

// Recurring transactions against an in-memory fake Prisma: which
// occurrences get written, under which category, and how a rule moves on.
const { dbRef } = vi.hoisted(() => ({ dbRef: { current: null as unknown } }))
vi.mock('../../../server/utils/db', () => ({
  getPrisma: () => dbRef.current as unknown as PrismaClient
}))

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

type Rule = {
  id: number
  user_id: string
  type: string
  name: string
  amount: number
  currency: string | null
  category: number
  unit: string
  every: number
  start_date: Date
  end_date: Date | null
  next_date: Date
  paused: boolean
  created_at: Date
}

function rule(over: Partial<Rule> = {}): Rule {
  return {
    id: 1,
    user_id: 'u1',
    type: 'expense',
    name: 'Rent',
    amount: 15000,
    currency: 'CZK',
    category: 3,
    unit: 'month',
    every: 1,
    start_date: d('2026-08-31'),
    end_date: null,
    next_date: d('2026-08-31'),
    paused: false,
    created_at: new Date(0),
    ...over
  }
}

// One store of rules, so a write is visible to the read after it.
function makeDb(rules: Rule[] = []) {
  const store = new Map(rules.map(r => [r.id, { ...r }]))
  const find = (where: { id?: number, user_id?: string }) =>
    [...store.values()].find(r => (where.id === undefined || r.id === where.id) && (where.user_id === undefined || r.user_id === where.user_id)) ?? null
  const labels = [{ id: 3, label: 'Housing' }, { id: 4, label: 'Other' }, { id: 5, label: 'Salary' }]
  const categories = (owned: number[], defaultId: number | null) => ({
    findFirst: vi.fn(async ({ where }: { where: { id?: number, is_default?: boolean } }) => {
      if (where.id !== undefined) return owned.includes(where.id) ? { id: where.id } : null
      return where.is_default && defaultId !== null ? { id: defaultId } : null
    }),
    findMany: vi.fn(async () => labels)
  })
  return {
    store,
    recurringTransaction: {
      findMany: vi.fn(async ({ where }: { where: { paused?: boolean, next_date?: { lte: Date }, user_id?: string } }) =>
        [...store.values()].filter(r =>
          (where.paused === undefined || r.paused === where.paused)
          && (!where.next_date || r.next_date <= where.next_date.lte)
          && (where.user_id === undefined || r.user_id === where.user_id))),
      findFirst: vi.fn(async ({ where }: { where: { id: number, user_id: string } }) => find(where)),
      create: vi.fn(async ({ data }: { data: Omit<Rule, 'id' | 'paused' | 'created_at'> }) => {
        const row = { ...data, id: 7, paused: false, created_at: new Date(0) } as Rule
        store.set(row.id, row)
        return row
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: number, next_date?: Date }, data: Partial<Rule> }) => {
        const row = store.get(where.id)
        if (!row || (where.next_date && row.next_date.getTime() !== where.next_date.getTime())) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      }),
      deleteMany: vi.fn(async () => ({ count: 1 }))
    },
    expense: {
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      findFirst: vi.fn(async (): Promise<{ category: number } | null> => null),
      updateMany: vi.fn(async () => ({ count: 2 }))
    },
    income: {
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      findFirst: vi.fn(async (): Promise<{ category: number } | null> => null),
      updateMany: vi.fn(async () => ({ count: 0 }))
    },
    expenseCategory: categories([3, 4], 4),
    incomeCategory: categories([5], null),
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
  }
}

let db: ReturnType<typeof makeDb>
const use = (fake: ReturnType<typeof makeDb>) => {
  db = fake
  dbRef.current = fake
}
beforeEach(() => use(makeDb()))

const written = () => db.expense.createMany.mock.calls.flatMap(c => (c[0].data as { date: Date }[]).map(r => r.date.toISOString().slice(0, 10)))

describe('materializeDue', () => {
  it('writes every occurrence that has come due, and moves on past them', async () => {
    use(makeDb([rule()]))
    expect(await materializeDue('2026-11-01')).toBe(3)
    expect(written()).toEqual(['2026-08-31', '2026-09-30', '2026-10-31'])
    const call = db.expense.createMany.mock.calls[0][0] as unknown as { data: { recurring_id: number, category: number, name: string }[], skipDuplicates: boolean }
    expect(call.skipDuplicates).toBe(true)
    expect(call.data[0]).toMatchObject({ recurring_id: 1, category: 3, name: 'Rent', user_id: 'u1' })
    expect(db.store.get(1)!.next_date).toEqual(d('2026-11-30'))
  })

  it('moves the next date only from where it was read', async () => {
    use(makeDb([rule()]))
    await materializeDue('2026-09-01')
    expect(db.recurringTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: 1, next_date: d('2026-08-31') },
      data: { next_date: d('2026-09-30') }
    })
  })

  it('stops at the end date', async () => {
    use(makeDb([rule({ end_date: d('2026-09-30') })]))
    await materializeDue('2026-12-31')
    expect(written()).toEqual(['2026-08-31', '2026-09-30'])
  })

  it('leaves a paused rule, and one not yet due, alone', async () => {
    use(makeDb([rule({ paused: true }), rule({ id: 2, next_date: d('2026-12-01') })]))
    expect(await materializeDue('2026-11-01')).toBe(0)
    expect(db.expense.createMany).not.toHaveBeenCalled()
  })

  it('writes an income into the income table', async () => {
    use(makeDb([rule({ type: 'income', category: 5, unit: 'week', next_date: d('2026-10-20'), start_date: d('2026-10-20') })]))
    await materializeDue('2026-11-01')
    expect(db.income.createMany).toHaveBeenCalledOnce()
    expect(db.expense.createMany).not.toHaveBeenCalled()
  })

  it('carries on past a rule that fails', async () => {
    use(makeDb([rule(), rule({ id: 2 })]))
    db.expense.createMany.mockRejectedValueOnce(new Error('boom'))
    expect(await materializeDue('2026-09-01')).toBe(1)
  })
})

describe('createRecurringScoped', () => {
  const base = { type: 'expense' as const, name: 'Rent', amount: 15000, currency: 'CZK', unit: 'month' as const, every: 1, start_date: '2026-11-01', end_date: null }

  it('writes an occurrence that is already due straight away', async () => {
    const made = await createRecurringScoped('u1', { ...base, category: 3 }, '2026-11-01')
    expect(written()).toEqual(['2026-11-01'])
    expect(made).toMatchObject({ id: 7, next_date: '2026-12-01', category: { id: 3, label: 'Housing' } })
  })

  it('writes nothing yet for a start in the future', async () => {
    const made = await createRecurringScoped('u1', { ...base, category: 3, start_date: '2026-11-15' }, '2026-11-01')
    expect(db.expense.createMany).not.toHaveBeenCalled()
    expect(made.next_date).toBe('2026-11-15')
  })

  it('takes the category the same name had last time, else the default', async () => {
    db.expense.findFirst.mockResolvedValueOnce({ category: 3 })
    expect((await createRecurringScoped('u1', base, '2026-10-01')).category.id).toBe(3)
    expect((await createRecurringScoped('u1', { ...base, name: 'Gym' }, '2026-10-01')).category.id).toBe(4)
  })

  it('refuses when there is no category to be had', async () => {
    await expect(createRecurringScoped('u1', { ...base, type: 'income', name: 'Bonus' }, '2026-10-01'))
      .rejects.toBeInstanceOf(CategoryRequired)
    expect(db.recurringTransaction.create).not.toHaveBeenCalled()
  })
})

describe('updateRecurringScoped', () => {
  it('resumes from the first occurrence on or after today, skipping the pause', async () => {
    use(makeDb([rule({ paused: true, next_date: d('2026-08-31') })]))
    const resumed = await updateRecurringScoped('u1', 1, { paused: false }, '2026-11-01')
    expect(resumed.paused).toBe(false)
    expect(written()).toEqual([])
    expect(resumed.next_date).toBe('2026-11-30')
  })

  it("is a 404 for somebody else's rule", async () => {
    use(makeDb([rule({ user_id: 'u2' })]))
    await expect(updateRecurringScoped('u1', 1, { paused: true }, '2026-11-01')).rejects.toBeInstanceOf(RecurringNotFound)
  })

  it('reports a rule past its end as finished', async () => {
    use(makeDb([rule({ end_date: d('2026-09-30'), next_date: d('2026-10-31') })]))
    expect((await updateRecurringScoped('u1', 1, { amount: 16000 }, '2026-11-01')).next_date).toBeNull()
  })
})

describe('deleteRecurringScoped', () => {
  it('keeps what it wrote, as ordinary transactions, in one transaction', async () => {
    use(makeDb([rule()]))
    await deleteRecurringScoped('u1', 1)
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(db.expense.updateMany).toHaveBeenCalledWith({ where: { user_id: 'u1', recurring_id: 1 }, data: { recurring_id: null } })
    expect(db.recurringTransaction.deleteMany).toHaveBeenCalledWith({ where: { id: 1, user_id: 'u1' } })
  })
})
