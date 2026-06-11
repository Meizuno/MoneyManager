import type { Prisma } from '@prisma/client'
import type {
  CreateExpenseCategoryInput,
  ExpenseCategory,
  UpdateExpenseCategoryInput
} from '#shared/schemas/expense-category'
import { getPrisma } from './db'
import { ExpenseCategoryNotFound } from './errors'
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
    ...(input.percent !== undefined ? { percent: input.percent } : {})
  }
  const db = getPrisma()
  const { count } = await db.expenseCategory.updateMany({
    where: { id, user_id: viewerId },
    data
  })
  if (count === 0) throw new ExpenseCategoryNotFound(id)
  const row = await db.expenseCategory.findUniqueOrThrow({ where: { id } })
  return toExpenseCategory(row)
}

export async function deleteExpenseCategoryScoped(
  viewerId: string,
  id: number
): Promise<{ deleted: number }> {
  const { count } = await getPrisma().expenseCategory.deleteMany({
    where: { id, user_id: viewerId }
  })
  if (count === 0) throw new ExpenseCategoryNotFound(id)
  return { deleted: id }
}
