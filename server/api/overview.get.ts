import { listTransactionsQuerySchema } from '#shared/schemas/transaction'

export default defineEventHandler(async (event) => {
  // Same filters as the list/summary endpoints; the service authorizes
  // `read` and resolves everything the overview needs in one pass.
  const query = await getValidatedQuery(event, listTransactionsQuerySchema.parse)
  return getOverview(event, query)
})
