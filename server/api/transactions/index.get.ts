import { listTransactionsQuerySchema } from '#shared/schemas/transaction'

export default defineEventHandler(async (event) => {
  // Preserve historical soft-fallback for unauthenticated callers (the
  // page composables sometimes fetch before auth has hydrated; the
  // guest-mode flow also relies on this). Authed requests go through
  // the service, which enforces the user_id scope.
  if (!event.context.user) return { items: [] }
  const query = await getValidatedQuery(event, listTransactionsQuerySchema.parse)
  const items = await listTransactions(event, query)
  return { items }
})
