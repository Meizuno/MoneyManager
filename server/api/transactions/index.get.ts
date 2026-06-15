import { listTransactionsQuerySchema } from '#shared/schemas/transaction'

export default defineEventHandler(async (event) => {
  // The service authorizes the `read` scope (resolving session/JWT/PAT),
  // so an anonymous or under-scoped caller gets 401/403 here.
  const query = await getValidatedQuery(event, listTransactionsQuerySchema.parse)
  const items = await listTransactions(event, query)
  return { items }
})
