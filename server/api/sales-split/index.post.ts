import { createExpenseCategorySchema } from '#shared/schemas/expense-category'

export default defineEventHandler(async (event) => {
  const input = await readValidatedBody(event, createExpenseCategorySchema.parse)
  return createExpenseCategory(event, input)
})
