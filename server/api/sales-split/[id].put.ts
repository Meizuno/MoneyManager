import { getRouterParam } from 'h3'
import { updateExpenseCategorySchema } from '#shared/schemas/expense-category'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid rule id' })
  }
  const input = await readValidatedBody(event, updateExpenseCategorySchema.parse)
  return updateExpenseCategory(event, id, input)
})
