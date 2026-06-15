import type { Prisma } from '@prisma/client'
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  Transaction,
  TransactionType,
  UpdateTransactionInput
} from '#shared/schemas/transaction'
import { DEFAULT_CURRENCY } from '#shared/schemas/transaction'
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

// List + filter, scoped to one user. Reads from both tables when no
// type filter is set and merges by date desc (id desc tiebreaker).
export async function listTransactionsScoped(
  viewerId: string,
  query: ListTransactionsQuery
): Promise<Transaction[]> {
  const db = getPrisma()
  const { type, category, dateFrom, dateTo } = query

  const dateRange = (dateFrom || dateTo)
    ? {
        date: {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
          ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {})
        }
      }
    : {}

  const where = {
    user_id: viewerId,
    ...(category !== undefined ? { category } : {}),
    ...dateRange
  }
  const orderBy = [{ date: 'desc' as const }, { id: 'desc' as const }]

  if (type === 'income') {
    const [rows, labels] = await Promise.all([
      db.income.findMany({ where, orderBy }),
      incomeCategoryLabels(viewerId)
    ])
    return rows.map(r => toTransaction(r, 'income', labels))
  }
  if (type === 'expense') {
    const [rows, labels] = await Promise.all([
      db.expense.findMany({ where, orderBy }),
      expenseCategoryLabels(viewerId)
    ])
    return rows.map(r => toTransaction(r, 'expense', labels))
  }

  const [incomes, expenses, incomeLabels, expenseLabels] = await Promise.all([
    db.income.findMany({ where, orderBy }),
    db.expense.findMany({ where, orderBy }),
    incomeCategoryLabels(viewerId),
    expenseCategoryLabels(viewerId)
  ])
  return [
    ...incomes.map(r => toTransaction(r, 'income', incomeLabels)),
    ...expenses.map(r => toTransaction(r, 'expense', expenseLabels))
  ].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return b.id - a.id
  })
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
