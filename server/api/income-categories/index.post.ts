import { createIncomeCategorySchema } from '#shared/schemas/income-category'

export default defineEventHandler(async (event) => {
  const input = await readValidatedBody(event, createIncomeCategorySchema.parse)
  return createIncomeCategory(event, input)
})
