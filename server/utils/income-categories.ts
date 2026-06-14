import type { Prisma } from '@prisma/client'
import type {
  CreateIncomeCategoryInput,
  IncomeCategory
} from '#shared/schemas/income-category'
import { getPrisma } from './db'
import { IncomeCategoryNotFound } from './errors'
import { nextColor } from './salesSplitColors'

// Single home for income-category data-access. The user_id scope, the
// auto-colour/position assignment, and the atomic scoped CRUD live
// here exactly once so every caller shares one source of truth.

// Convert a DB row into the wire shape (Date → ISO string).
function toIncomeCategory(row: {
  id: number
  label: string
  color: string
  position: number
  created_at: Date
}): IncomeCategory {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    position: row.position,
    created_at: row.created_at.toISOString()
  }
}

export async function listIncomeCategoriesScoped(viewerId: string): Promise<IncomeCategory[]> {
  const rows = await getPrisma().incomeCategory.findMany({
    where: { user_id: viewerId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }]
  })
  return rows.map(toIncomeCategory)
}

// Scoped existence check used by the transaction layer to validate a
// supplied category id before writing. Mirrors expenseCategoryExists —
// the user_id filter keeps a stranger's id from validating against this
// user's transactions. Caller owns the "0 = uncategorised" sentinel.
export async function incomeCategoryExists(viewerId: string, id: number): Promise<boolean> {
  const row = await getPrisma().incomeCategory.findFirst({
    where: { id, user_id: viewerId },
    select: { id: true }
  })
  return row !== null
}

// id → label map for the viewer's income categories. Mirrors
// expenseCategoryLabels — used by the transaction reads to resolve the
// stored category id into its label (no Prisma relation exists, so the
// join lives in application code).
export async function incomeCategoryLabels(viewerId: string): Promise<Map<number, string>> {
  const rows = await getPrisma().incomeCategory.findMany({
    where: { user_id: viewerId },
    select: { id: true, label: true }
  })
  return new Map(rows.map(r => [r.id, r.label]))
}

// Append a new category to the end of the user's list, picking the
// next palette colour. Position is intentionally the current count so
// the new entry shows up after every existing one.
export async function createIncomeCategoryScoped(
  viewerId: string,
  input: CreateIncomeCategoryInput
): Promise<IncomeCategory> {
  const db = getPrisma()
  const count = await db.incomeCategory.count({ where: { user_id: viewerId } })
  const row = await db.incomeCategory.create({
    data: {
      user_id: viewerId,
      label: input.label,
      color: nextColor(count),
      position: count
    }
  })
  return toIncomeCategory(row)
}

// Atomic scoped update: the user_id filter rides in the where clause
// so a stranger holding an id can't modify another user's category.
// `data` must contain at least one field — empty updates are a 400
// from the service.
export async function updateIncomeCategoryScoped(
  viewerId: string,
  id: number,
  data: Prisma.IncomeCategoryUpdateInput
): Promise<IncomeCategory> {
  const db = getPrisma()
  const { count } = await db.incomeCategory.updateMany({
    where: { id, user_id: viewerId },
    data
  })
  if (count === 0) throw new IncomeCategoryNotFound(id)
  // updateMany returns a count, not the row; one extra read for the
  // fresh projection. Same trade the old handler made.
  const row = await db.incomeCategory.findUniqueOrThrow({ where: { id } })
  return toIncomeCategory(row)
}

// Atomic scoped delete. `count === 0` is the not-found signal.
export async function deleteIncomeCategoryScoped(
  viewerId: string,
  id: number
): Promise<{ deleted: number }> {
  const { count } = await getPrisma().incomeCategory.deleteMany({
    where: { id, user_id: viewerId }
  })
  if (count === 0) throw new IncomeCategoryNotFound(id)
  return { deleted: id }
}
