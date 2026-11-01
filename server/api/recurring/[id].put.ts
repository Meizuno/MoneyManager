import { getRouterParam } from 'h3'
import { updateRecurringSchema } from '#shared/schemas/recurring'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recurring transaction id' })
  }
  const input = await readValidatedBody(event, updateRecurringSchema.parse)
  return updateRecurring(event, id, input)
})
