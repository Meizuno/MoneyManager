import { listTransactionsQuerySchema } from '#shared/schemas/transaction'

export default defineEventHandler(async (event) => {
  // Same filters as the list endpoint; the service authorizes `read`
  // (session/JWT/PAT) before aggregating.
  const query = await getValidatedQuery(event, listTransactionsQuerySchema.parse)
  return summarizeTransactions(event, query)
})
