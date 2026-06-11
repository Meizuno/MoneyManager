import { getRouterParam } from 'h3'
import { updateIncomeCategorySchema } from '#shared/schemas/income-category'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category id' })
  }
  const input = await readValidatedBody(event, updateIncomeCategorySchema.parse)
  return updateIncomeCategory(event, id, input)
})
