import type { Prisma } from '@prisma/client'
import type {
  CreateExpenseCategoryInput,
  ExpenseCategory,
  UpdateExpenseCategoryInput
} from '#shared/schemas/expense-category'
import { getPrisma } from './db'
import { CategoryInUse, ExpenseCategoryNotFound } from './errors'
import { nextColor } from './salesSplitColors'

// Single home for expense-category (sales-split rule) data-access.
// Mirrors income-categories — the user_id scope and auto-assigned
// colour/position live here exactly once.

type DbRow = {
  id: number
  label: string
  percent: Prisma.Decimal
  color: string
  position: number
  is_default: boolean
  created_at: Date
}

// Convert a DB row to the wire shape — Decimal → Number for the
// percent field (Prisma's Decimal is a runtime object).
function toExpenseCategory(row: DbRow): ExpenseCategory {
  return {
    id: row.id,
    label: row.label,
    percent: Number(row.percent),
    color: row.color,
    position: row.position,
    is_default: row.is_default,
    created_at: row.created_at.toISOString()
  }
}

export async function listExpenseCategoriesScoped(viewerId: string): Promise<ExpenseCategory[]> {
  const rows = await getPrisma().expenseCategory.findMany({
    where: { user_id: viewerId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }]
  })
  return rows.map(toExpenseCategory)
}

// Apply a new ordering: position = index in `ids`. Each update is scoped by
// user_id, so foreign ids silently no-op (count 0) and can't reorder another
// user's rows. Wrapped in a transaction so the list is never half-reordered.
export async function reorderExpenseCategoriesScoped(viewerId: string, ids: number[]): Promise<ExpenseCategory[]> {
  const db = getPrisma()
  await db.$transaction(
    ids.map((id, index) =>
      db.expenseCategory.updateMany({ where: { id, user_id: viewerId }, data: { position: index } })
    )
  )
  return listExpenseCategoriesScoped(viewerId)
}

// Scoped existence check used by the transaction layer to validate a
// supplied category id before writing. Returns true only when a row with
// this id belongs to the viewer — the user_id filter keeps a stranger's
// id from validating against this user's transactions. Caller owns the
// "0 = uncategorised" sentinel; this is a pure row-exists probe.
export async function expenseCategoryExists(viewerId: string, id: number): Promise<boolean> {
  const row = await getPrisma().expenseCategory.findFirst({
    where: { id, user_id: viewerId },
    select: { id: true }
  })
  return row !== null
}

// The viewer's default expense category, or null when none is set. What a
// new expense falls back to when nothing of its name came before.
export async function defaultExpenseCategory(viewerId: string): Promise<number | null> {
  const row = await getPrisma().expenseCategory.findFirst({
    where: { user_id: viewerId, is_default: true },
    select: { id: true }
  })
  return row?.id ?? null
}

// id → label map for the viewer's expense categories. Used by the
// transaction reads to resolve the stored category id into its label
// (there is no Prisma relation between the row's `category` int and the
// category tables, so the join is done in application code).
export async function expenseCategoryLabels(viewerId: string): Promise<Map<number, string>> {
  const rows = await getPrisma().expenseCategory.findMany({
    where: { user_id: viewerId },
    select: { id: true, label: true }
  })
  return new Map(rows.map(r => [r.id, r.label]))
}

export async function createExpenseCategoryScoped(
  viewerId: string,
  input: CreateExpenseCategoryInput
): Promise<ExpenseCategory> {
  const db = getPrisma()
  const count = await db.expenseCategory.count({ where: { user_id: viewerId } })
  const row = await db.expenseCategory.create({
    data: {
      user_id: viewerId,
      label: input.label,
      percent: input.percent,
      color: nextColor(count),
      position: count
    }
  })
  return toExpenseCategory(row)
}

export async function updateExpenseCategoryScoped(
  viewerId: string,
  id: number,
  input: UpdateExpenseCategoryInput
): Promise<ExpenseCategory> {
  // Spread the validated input directly — every key is a real column,
  // and absence already means "leave unchanged" because zod kept
  // `.optional()` on each field.
  const data: Prisma.ExpenseCategoryUpdateInput = {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.percent !== undefined ? { percent: input.percent } : {}),
    ...(input.is_default !== undefined ? { is_default: input.is_default } : {})
  }
  const db = getPrisma()
  // Becoming the default takes the mark off whichever category had it, in
  // the same transaction, so a user never has two. Ownership is checked
  // first: a stranger's id must not clear this user's default on its way
  // to a 404.
  if (input.is_default === true) {
    if (!(await expenseCategoryExists(viewerId, id))) throw new ExpenseCategoryNotFound(id)
    await db.$transaction([
      db.expenseCategory.updateMany({
        where: { user_id: viewerId, is_default: true, NOT: { id } },
        data: { is_default: false }
      }),
      db.expenseCategory.updateMany({ where: { id, user_id: viewerId }, data })
    ])
  }
  else {
    const { count } = await db.expenseCategory.updateMany({
      where: { id, user_id: viewerId },
      data
    })
    if (count === 0) throw new ExpenseCategoryNotFound(id)
  }
  const row = await db.expenseCategory.findUniqueOrThrow({ where: { id } })
  return toExpenseCategory(row)
}

export async function deleteExpenseCategoryScoped(
  viewerId: string,
  id: number
): Promise<{ deleted: number }> {
  const db = getPrisma()
  // Refuse to delete a category still referenced by expense transactions —
  // category reads are strict, so orphaning a reference would break them.
  // A recurring expense counts too: its next occurrence would be written
  // under a category that is gone.
  const [inUse, recurring] = await Promise.all([
    db.expense.count({ where: { user_id: viewerId, category: id } }),
    db.recurringTransaction.count({ where: { user_id: viewerId, type: 'expense', category: id } })
  ])
  if (inUse > 0 || recurring > 0) throw new CategoryInUse(id, inUse, recurring)
  const { count } = await db.expenseCategory.deleteMany({
    where: { id, user_id: viewerId }
  })
  if (count === 0) throw new ExpenseCategoryNotFound(id)
  return { deleted: id }
}
