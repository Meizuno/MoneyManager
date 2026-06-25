import { z } from 'zod'

// Expense-category (a.k.a. "sales-split rule") request shapes, shared
// across client and server. Distinguished from IncomeCategory by the
// extra `percent` field — these rows describe how a user wants to
// split outgoing money across buckets, so each carries a target share.
//
// Wire URL is /api/sales-split/* (historical name); the model and
// table are named ExpenseCategory in Prisma. Don't rename the route.

const percentSchema = z.coerce.number()
  .refine(n => Number.isFinite(n) && n >= 0 && n <= 100, {
    message: 'Percent must be a number between 0 and 100'
  })

export const createExpenseCategorySchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100),
  // Default 10% so a brand-new rule shows up at the same size the old
  // handler used when the client omitted percent.
  percent: percentSchema.default(10)
})
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>

// Update — every field optional. The service rejects the empty
// object as 400 ("nothing to update").
export const updateExpenseCategorySchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100).optional(),
  percent: percentSchema.optional()
})
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>

// Wire shape — percent is a number here (Prisma's Decimal is
// serialized by the service before it leaves).
export type ExpenseCategory = {
  id: number
  label: string
  percent: number
  color: string
  position: number
  created_at: string
}

// Reorder — the desired full ordering of category ids; the service assigns
// position = array index. Structural mutation (full-access only).
export const reorderExpenseCategoriesSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1)
})
export type ReorderExpenseCategoriesInput = z.infer<typeof reorderExpenseCategoriesSchema>
