import { getRouterParam } from 'h3'
import { updateTransactionSchema } from '#shared/schemas/transaction'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid transaction id' })
  }
  const input = await readValidatedBody(event, updateTransactionSchema.parse)
  const item = await updateTransaction(event, id, input)
  return { item }
})
