import type { Prisma } from '@prisma/client'
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  MonthTotals,
  Transaction,
  TransactionSummary,
  TransactionType,
  UpdateTransactionInput
} from '#shared/schemas/transaction'
import { DEFAULT_CURRENCY } from '#shared/schemas/transaction'
import { firstDayOf, lastDayOf, monthsBetween } from '#shared/utils/months'
import { getPrisma } from './db'
import { CategoryNotFound, CategoryRequired, TransactionNotFound } from './errors'
import { expenseCategoryExists, expenseCategoryLabels } from './expense-categories'
import { incomeCategoryExists, incomeCategoryLabels } from './income-categories'

// Single home for transaction data-access. Income and Expense live in
// separate Prisma tables but are one logical resource over HTTP/MCP/
// prompts, so the routing-between-tables and the user_id scope live
// here exactly once — every caller goes through these functions and a
// new call site can't forget the user_id filter.
//
// The viewer is passed explicitly as a user id (string) instead of
// read off event.context, so the same functions serve HTTP (via
// viewerId(event)) and MCP / prompts (header-supplied id).

// Row shape Prisma gives us back from either table; Decimal is a
// runtime object that we convert to Number at the wire boundary.
type DbRow = {
  id: number
  date: Date
  name: string
  amount: Prisma.Decimal
  currency: string | null
  category: number
  created_at: Date
}

// Convert a DB row + known type into the wire-format Transaction. The
// `category` field carries the stored id and its joined label, resolved
// STRICTLY: every transaction must reference a real category, so a row
// whose id has no matching label (the 0/uncategorised sentinel, or a
// since-deleted category) is a data-integrity error rather than an
// `{ id, label: '' }` placeholder. Writes enforce existence and category
// deletion is blocked while in use, so this should never fire in practice.
function toTransaction(row: DbRow, type: TransactionType, labels: Map<number, string>): Transaction {
  const label = labels.get(row.category)
  if (label === undefined) throw new CategoryNotFound(type, row.category)
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    name: row.name,
    amount: Number(row.amount),
    currency: row.currency,
    type,
    category: { id: row.category, label },
    created_at: row.created_at.toISOString()
  }
}

// Normalize a validated create/update input into the per-row fields
// Prisma actually writes. Pulled out of create/update so they share
// the same currency-trim + amount-abs handling.
function rowDataFromInput(input: CreateTransactionInput | UpdateTransactionInput) {
  // The schemas already trim/clean these; absolute value here so
  // amount sign is purely the type discriminator.
  return {
    ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.amount !== undefined ? { amount: Math.abs(input.amount) } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.category !== undefined ? { category: input.category } : {})
  }
}

// Enforce category integrity before a write: the supplied category must
// belong to the viewer AND live in the table matching the resolved
// transaction type (expense → expense_categories, income →
// income_categories). There is no uncategorised sentinel — 0 has no row
// and so fails this check like any other non-existent id (CategoryNotFound).
async function assertCategoryValid(
  viewerId: string,
  type: TransactionType,
  category: number
): Promise<void> {
  const exists = type === 'expense'
    ? await expenseCategoryExists(viewerId, category)
    : await incomeCategoryExists(viewerId, category)
  if (!exists) throw new CategoryNotFound(type, category)
}

// Derive transaction type when the caller omitted it: negative amount
// → expense, else income. Matches long-standing API behaviour from the
// pre-refactor normalizeTransactionInput.
function deriveType(input: CreateTransactionInput): TransactionType {
  if (input.type) return input.type
  return input.amount < 0 ? 'expense' : 'income'
}

// Build the Prisma `where` shared by list + summary: scope to the viewer,
// optionally pin a category, and bound an inclusive date range. The same
// clause runs against both the income and expense tables.
function scopedWhere(viewerId: string, query: ListTransactionsQuery) {
  const { category, dateFrom, dateTo } = query
  const dateRange = (dateFrom || dateTo)
    ? {
        date: {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
          ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {})
        }
      }
    : {}
  return {
    user_id: viewerId,
    ...(category !== undefined ? { category } : {}),
    ...dateRange
  }
}

// Category id → label, per table: what the read projection resolves a
// row's category against.
export type CategoryLabels = { income: Map<number, string>, expense: Map<number, string> }

const NO_LABELS = new Map<number, string>()

// The columns a Transaction is built from. user_id is the filter, never
// part of the answer, so it isn't read back.
const COLUMNS = { id: true, date: true, name: true, amount: true, currency: true, category: true, created_at: true } as const

async function labelsScoped(viewerId: string, income: boolean, expense: boolean): Promise<CategoryLabels> {
  const [incomeLabels, expenseLabels] = await Promise.all([
    income ? incomeCategoryLabels(viewerId) : NO_LABELS,
    expense ? expenseCategoryLabels(viewerId) : NO_LABELS
  ])
  return { income: incomeLabels, expense: expenseLabels }
}

// List + filter, scoped to one user. Reads from both tables when no
// type filter is set and merges by date desc (id desc tiebreaker).
//
// `labels` is for a caller that reads the category lists anyway (the
// overview): it hands their labels in instead of having them read twice.
// It may be a promise, so those reads still run alongside the rows.
export async function listTransactionsScoped(
  viewerId: string,
  query: ListTransactionsQuery,
  labels?: CategoryLabels | Promise<CategoryLabels>
): Promise<Transaction[]> {
  const db = getPrisma()
  const where = scopedWhere(viewerId, query)
  const orderBy = [{ date: 'desc' as const }, { id: 'desc' as const }]
  const wantIncome = query.type !== 'expense'
  const wantExpense = query.type !== 'income'

  const [incomes, expenses, resolved] = await Promise.all([
    wantIncome ? db.income.findMany({ where, orderBy, select: COLUMNS }) : [],
    wantExpense ? db.expense.findMany({ where, orderBy, select: COLUMNS }) : [],
    labels ?? labelsScoped(viewerId, wantIncome, wantExpense)
  ])
  const items = [
    ...incomes.map(r => toTransaction(r, 'income', resolved.income)),
    ...expenses.map(r => toTransaction(r, 'expense', resolved.expense))
  ]
  // One table comes back in order already; two have to be merged.
  if (!wantIncome || !wantExpense) return items
  return items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return b.id - a.id
  })
}

// What summarizeTransactionsScoped computes in the database, from rows
// already in hand — for a caller that has fetched them anyway.
export function summarizeItems(items: Transaction[]): TransactionSummary {
  let income = 0
  let expenses = 0
  let incomeCount = 0
  for (const item of items) {
    if (item.type === 'income') {
      income += item.amount
      incomeCount++
    }
    else expenses += item.amount
  }
  // Cents can drift when many amounts are added as floats.
  const cents = (n: number) => Math.round(n * 100) / 100
  return {
    income: cents(income),
    expenses: cents(expenses),
    net: cents(income - expenses),
    incomeCount,
    expenseCount: items.length - incomeCount
  }
}

// Aggregate the filtered transactions in the database rather than pulling
// every row to the client. Sums the stored (absolute) amounts per table;
// a `type` filter skips the other table entirely so its sum/count is 0.
export async function summarizeTransactionsScoped(
  viewerId: string,
  query: ListTransactionsQuery
): Promise<TransactionSummary> {
  const db = getPrisma()
  const where = scopedWhere(viewerId, query)
  const wantIncome = query.type !== 'expense'
  const wantExpense = query.type !== 'income'

  const [incomeAgg, expenseAgg] = await Promise.all([
    wantIncome ? db.income.aggregate({ _sum: { amount: true }, _count: true, where }) : Promise.resolve(null),
    wantExpense ? db.expense.aggregate({ _sum: { amount: true }, _count: true, where }) : Promise.resolve(null)
  ])

  const income = incomeAgg ? Number(incomeAgg._sum.amount ?? 0) : 0
  const expenses = expenseAgg ? Number(expenseAgg._sum.amount ?? 0) : 0
  return {
    income,
    expenses,
    net: income - expenses,
    incomeCount: incomeAgg?._count ?? 0,
    expenseCount: expenseAgg?._count ?? 0
  }
}

// Income and expense totals per calendar month from `fromMonth` to
// `toMonth` (`YYYY-MM`, both included), zero-filled so a chart gets one
// point per month. Postgres sums by month in one query over both tables:
// a dozen rows each, where Prisma's groupBy could only group by day and
// hand back every day of the year (several times the CPU, measured).
// Parameterised by the tagged template — no value is spliced into the SQL.
export async function monthlyTotalsScoped(
  viewerId: string,
  fromMonth: string,
  toMonth: string
): Promise<MonthTotals[]> {
  const from = new Date(`${firstDayOf(fromMonth)}T00:00:00.000Z`)
  const to = new Date(`${lastDayOf(toMonth)}T23:59:59.999Z`)
  const sums = await getPrisma().$queryRaw<{ kind: 'income' | 'expense', month: string, total: unknown }[]>`
    SELECT 'income' AS kind, to_char(date, 'YYYY-MM') AS month, sum(amount) AS total
      FROM incomes WHERE user_id = ${viewerId} AND date >= ${from} AND date <= ${to} GROUP BY 2
    UNION ALL
    SELECT 'expense', to_char(date, 'YYYY-MM'), sum(amount)
      FROM expenses WHERE user_id = ${viewerId} AND date >= ${from} AND date <= ${to} GROUP BY 2`

  const months = new Map(monthsBetween(fromMonth, toMonth).map(month => [month, { month, income: 0, expenses: 0 }]))
  for (const { kind, month, total } of sums) {
    const entry = months.get(month)
    if (!entry) continue
    // numeric comes back as a Decimal; Number() reads it either way.
    const amount = Math.round(Number(total ?? 0) * 100) / 100
    if (kind === 'income') entry.income = amount
    else entry.expenses = amount
  }
  return [...months.values()]
}

// Resolve the id → label map for a single resolved type. Small helper so
// the create/update return paths can hand toTransaction a label without
// duplicating the type → table choice.
function categoryLabelsFor(viewerId: string, type: TransactionType): Promise<Map<number, string>> {
  return type === 'income' ? incomeCategoryLabels(viewerId) : expenseCategoryLabels(viewerId)
}

// Insert into the right table for the resolved type.
export async function createTransactionScoped(
  viewerId: string,
  input: CreateTransactionInput
): Promise<Transaction> {
  const type = deriveType(input)
  const category = input.category ?? 0
  // Create requires a real, existing category: reject omitted / 0
  // (uncategorised) here, then assertCategoryValid confirms the id exists
  // for the resolved type. Updates still allow leaving it uncategorised.
  if (!category) throw new CategoryRequired()
  await assertCategoryValid(viewerId, type, category)
  const data = {
    user_id: viewerId,
    date: new Date(input.date),
    name: input.name,
    amount: Math.abs(input.amount),
    // Default to CZK on create when none is given (covers both the HTTP
    // API and MCP) — matches the form's pre-fill and the display fallback.
    currency: input.currency ?? DEFAULT_CURRENCY,
    category
  }
  const db = getPrisma()
  const row = type === 'income'
    ? await db.income.create({ data })
    : await db.expense.create({ data })
  return toTransaction(row, type, await categoryLabelsFor(viewerId, type))
}

// Find a transaction by id, scoped to the viewer. Probes both tables;
// returns null when neither matches. The user_id filter is part of the
// query so a stranger holding an id never sees another user's row.
export async function loadTransactionScoped(
  viewerId: string,
  id: number
): Promise<{ row: DbRow, type: TransactionType } | null> {
  const db = getPrisma()
  const income = await db.income.findFirst({ where: { id, user_id: viewerId } })
  if (income) return { row: income, type: 'income' }
  const expense = await db.expense.findFirst({ where: { id, user_id: viewerId } })
  if (expense) return { row: expense, type: 'expense' }
  return null
}

// Update by id, scoped. When the input changes the type (income ↔
// expense) we move the row across tables; otherwise update in place.
// Throws TransactionNotFound when no row matches the viewer's scope.
export async function updateTransactionScoped(
  viewerId: string,
  id: number,
  input: UpdateTransactionInput
): Promise<Transaction> {
  const existing = await loadTransactionScoped(viewerId, id)
  if (!existing) throw new TransactionNotFound(id)

  // Type swap target: explicit override wins; otherwise stay where we are.
  const nextType: TransactionType = input.type ?? existing.type

  // Validate the category that will actually be persisted against the
  // resolved (possibly new) type. We re-check whenever the caller sends a
  // category OR the type changes — because an id valid under the old type
  // need not exist under the new type's table, even if the id itself is
  // unchanged. A no-op update (no category, no type change) skips the
  // probe: that row's category was already validated when it was written.
  const effectiveCategory = input.category ?? existing.row.category
  if (input.category !== undefined || nextType !== existing.type) {
    await assertCategoryValid(viewerId, nextType, effectiveCategory)
  }

  const data = rowDataFromInput(input)
  const db = getPrisma()

  if (nextType === existing.type) {
    const row = existing.type === 'income'
      ? await db.income.update({ where: { id }, data })
      : await db.expense.update({ where: { id }, data })
    return toTransaction(row, existing.type, await categoryLabelsFor(viewerId, existing.type))
  }

  // Type changed → delete from the old table and create in the new
  // one. The fields we're not explicitly updating fall back to the
  // existing row's values so the moved record keeps its identity.
  const fullData = {
    user_id: viewerId,
    date: data.date ?? existing.row.date,
    name: data.name ?? existing.row.name,
    amount: data.amount ?? Number(existing.row.amount),
    currency: data.currency !== undefined ? data.currency : existing.row.currency,
    category: data.category ?? existing.row.category
  }
  if (existing.type === 'income') {
    await db.income.delete({ where: { id } })
    const row = await db.expense.create({ data: fullData })
    return toTransaction(row, 'expense', await expenseCategoryLabels(viewerId))
  }
  await db.expense.delete({ where: { id } })
  const row = await db.income.create({ data: fullData })
  return toTransaction(row, 'income', await incomeCategoryLabels(viewerId))
}

// Atomic scoped delete. deleteMany returns a count rather than
// throwing — `0` from both tables is the not-found signal.
export async function deleteTransactionScoped(
  viewerId: string,
  id: number
): Promise<{ deleted: number }> {
  const db = getPrisma()
  const inc = await db.income.deleteMany({ where: { id, user_id: viewerId } })
  if (inc.count > 0) return { deleted: id }
  const exp = await db.expense.deleteMany({ where: { id, user_id: viewerId } })
  if (exp.count > 0) return { deleted: id }
  throw new TransactionNotFound(id)
}
