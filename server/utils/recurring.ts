import type { Prisma } from '@prisma/client'
import type {
  CreateRecurringInput,
  RecurringTransaction,
  UpdateRecurringInput
} from '#shared/schemas/recurring'
import type { TransactionType } from '#shared/schemas/transaction'
import { DEFAULT_CURRENCY } from '#shared/schemas/transaction'
import { firstOnOrAfter, occurrencesThrough, todayIn, type RecurrenceUnit } from '#shared/utils/recurrence'
import { getPrisma } from './db'
import { CategoryNotFound, CategoryRequired, DomainError, RecurringNotFound } from './errors'
import { useLog } from './log'
import { expenseCategoryLabels } from './expense-categories'
import { incomeCategoryLabels } from './income-categories'
import { assertCategoryValid, resolveCategoryScoped } from './transactions'

// Single home for recurring-transaction data access, and for writing their
// occurrences. A rule is "this, every N units, from then, until then"; each
// occurrence it comes to is written as an ordinary income or expense with
// `recurring_id` set, so every list, total and chart counts it without
// knowing rules exist.
//
// Writing is idempotent twice over: (recurring_id, date) is unique on both
// transaction tables and the insert skips what is already there, and
// `next_date` only moves on from the value it was read at. Two runs at once
// — the timer and a create, two replicas — write each occurrence once.
//
// `today` is passed in, as a date in the app's zone (todayIn), so the rule
// can be tested without a clock.

const log = useLog('recurring')

// "Today" for every schedule: the date in the app's zone (NUXT_TIMEZONE),
// so a rent due on the 1st is written on the 1st in Prague rather than an
// hour into it by UTC, or the evening before. The functions below take it
// as an argument; this is where the HTTP, MCP and timer callers get it.
export function scheduleToday(): string {
  return todayIn(String(useRuntimeConfig().timezone || 'Europe/Prague'))
}

type DbRow = {
  id: number
  user_id: string
  type: string
  name: string
  amount: Prisma.Decimal
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

const day = (d: Date) => d.toISOString().slice(0, 10)
const asDate = (d: string) => new Date(`${d}T00:00:00.000Z`)

function scheduleOf(row: DbRow) {
  return {
    start: day(row.start_date),
    unit: row.unit as RecurrenceUnit,
    every: row.every,
    end: row.end_date ? day(row.end_date) : null
  }
}

function toRecurring(row: DbRow, labels: Map<number, string>): RecurringTransaction {
  const type = row.type as TransactionType
  const label = labels.get(row.category)
  if (label === undefined) throw new CategoryNotFound(type, row.category)
  const next = day(row.next_date)
  const end = row.end_date ? day(row.end_date) : null
  return {
    id: row.id,
    type,
    name: row.name,
    amount: Number(row.amount),
    currency: row.currency,
    category: { id: row.category, label },
    unit: row.unit as RecurrenceUnit,
    every: row.every,
    start_date: day(row.start_date),
    end_date: end,
    next_date: end && next > end ? null : next,
    paused: row.paused,
    created_at: row.created_at.toISOString()
  }
}

async function labelsFor(viewerId: string, types: Iterable<string>) {
  const wanted = new Set(types)
  const [income, expense] = await Promise.all([
    wanted.has('income') ? incomeCategoryLabels(viewerId) : new Map<number, string>(),
    wanted.has('expense') ? expenseCategoryLabels(viewerId) : new Map<number, string>()
  ])
  return { income, expense } as Record<string, Map<number, string>>
}

async function project(viewerId: string, row: DbRow): Promise<RecurringTransaction> {
  const labels = await labelsFor(viewerId, [row.type])
  return toRecurring(row, labels[row.type]!)
}

async function loadScoped(viewerId: string, id: number): Promise<DbRow> {
  const row = await getPrisma().recurringTransaction.findFirst({ where: { id, user_id: viewerId } })
  if (!row) throw new RecurringNotFound(id)
  return row
}

// Write every occurrence of one rule that has come due by `today`, and move
// its next date past them. Returns how many were due (a re-run counts the
// ones it found already written too; it writes nothing twice).
async function materialize(row: DbRow, today: string): Promise<number> {
  if (row.paused) return 0
  const { dates, next } = occurrencesThrough(day(row.next_date), today, scheduleOf(row))
  if (!dates.length) return 0
  const db = getPrisma()
  const data = dates.map(date => ({
    user_id: row.user_id,
    date: asDate(date),
    name: row.name,
    amount: row.amount,
    currency: row.currency,
    category: row.category,
    recurring_id: row.id
  }))
  if (row.type === 'income') await db.income.createMany({ data, skipDuplicates: true })
  else await db.expense.createMany({ data, skipDuplicates: true })
  // Only from where it was read: a concurrent run that already moved it on
  // keeps its own, and nothing is written twice either way.
  await db.recurringTransaction.updateMany({
    where: { id: row.id, next_date: row.next_date },
    data: { next_date: asDate(next) }
  })
  return dates.length
}

// Every rule that has come due — for one user, or (no viewer) for all of
// them, which is what the timer runs. A rule that fails is logged and
// skipped, so one bad row does not hold up everybody else's.
export async function materializeDue(today: string, viewerId?: string): Promise<number> {
  const rows = await getPrisma().recurringTransaction.findMany({
    where: {
      paused: false,
      next_date: { lte: asDate(today) },
      ...(viewerId ? { user_id: viewerId } : {})
    },
    orderBy: { id: 'asc' }
  })
  let written = 0
  for (const row of rows) {
    try {
      written += await materialize(row, today)
    }
    catch (error) {
      log.error('recurring transaction failed', { recurringId: row.id, error })
    }
  }
  return written
}

export async function listRecurringScoped(viewerId: string): Promise<RecurringTransaction[]> {
  const rows = await getPrisma().recurringTransaction.findMany({
    where: { user_id: viewerId },
    orderBy: [{ next_date: 'asc' }, { id: 'asc' }]
  })
  const labels = await labelsFor(viewerId, rows.map(r => r.type))
  return rows.map(r => toRecurring(r, labels[r.type]!))
}

// Make a rule, and write at once whatever of it is already due — a rent
// started on the 1st, made on the 5th, shows the 1st's straight away.
export async function createRecurringScoped(
  viewerId: string,
  input: CreateRecurringInput,
  today: string
): Promise<RecurringTransaction> {
  const category = input.category ?? (await resolveCategoryScoped(viewerId, input.type, input.name))?.id
  if (!category) throw new CategoryRequired()
  await assertCategoryValid(viewerId, input.type, category)
  const row = await getPrisma().recurringTransaction.create({
    data: {
      user_id: viewerId,
      type: input.type,
      name: input.name,
      amount: input.amount,
      currency: input.currency ?? DEFAULT_CURRENCY,
      category,
      unit: input.unit,
      every: input.every,
      start_date: asDate(input.start_date),
      end_date: input.end_date ? asDate(input.end_date) : null,
      next_date: asDate(input.start_date)
    }
  })
  await materialize(row, today)
  return project(viewerId, await loadScoped(viewerId, row.id))
}

// Change what a rule writes from now on, or pause and resume it. What it
// has written already stays as it is. Resuming picks up at the first
// occurrence from today: what fell due while it was paused is skipped, not
// written in a heap — a pause is "not these", not "later".
export async function updateRecurringScoped(
  viewerId: string,
  id: number,
  input: UpdateRecurringInput,
  today: string
): Promise<RecurringTransaction> {
  const existing = await loadScoped(viewerId, id)
  if (input.category !== undefined) {
    await assertCategoryValid(viewerId, existing.type as TransactionType, input.category)
  }
  const end = input.end_date === undefined ? undefined : input.end_date
  if (end && end < day(existing.start_date)) {
    throw new DomainError(400, 'Invalid end date', 'The end date cannot be before the start date')
  }
  const resuming = existing.paused && input.paused === false
  const data: Prisma.RecurringTransactionUpdateInput = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(end !== undefined ? { end_date: end ? asDate(end) : null } : {}),
    ...(input.paused !== undefined ? { paused: input.paused } : {}),
    ...(resuming
      ? { next_date: asDate(firstOnOrAfter(day(existing.next_date), today, scheduleOf(existing))) }
      : {})
  }
  await getPrisma().recurringTransaction.updateMany({ where: { id, user_id: viewerId }, data })
  const row = await loadScoped(viewerId, id)
  await materialize(row, today)
  return project(viewerId, await loadScoped(viewerId, id))
}

// Delete a rule. What it wrote stays, as ordinary transactions: they were
// real money, and the rule ending does not unspend it.
export async function deleteRecurringScoped(viewerId: string, id: number): Promise<{ deleted: number }> {
  await loadScoped(viewerId, id)
  const db = getPrisma()
  await db.$transaction([
    db.income.updateMany({ where: { user_id: viewerId, recurring_id: id }, data: { recurring_id: null } }),
    db.expense.updateMany({ where: { user_id: viewerId, recurring_id: id }, data: { recurring_id: null } }),
    db.recurringTransaction.deleteMany({ where: { id, user_id: viewerId } })
  ])
  return { deleted: id }
}
