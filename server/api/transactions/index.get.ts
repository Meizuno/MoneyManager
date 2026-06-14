import { listTransactionsQuerySchema } from '#shared/schemas/transaction'

export default defineEventHandler(async (event) => {
  // Soft-fallback for unauthenticated callers: page composables can fetch
  // before auth has fully hydrated, so return an empty list rather than a
  // 401. Authed requests go through the service, which enforces the
  // user_id scope.
  if (!event.context.user) return { items: [] }
  const query = await getValidatedQuery(event, listTransactionsQuerySchema.parse)
  const items = await listTransactions(event, query)
  return { items }
})
