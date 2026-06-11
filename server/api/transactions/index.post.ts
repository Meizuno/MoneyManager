import { createTransactionSchema } from '#shared/schemas/transaction'

export default defineEventHandler(async (event) => {
  const input = await readValidatedBody(event, createTransactionSchema.parse)
  const item = await createTransaction(event, input)
  return { item }
})
