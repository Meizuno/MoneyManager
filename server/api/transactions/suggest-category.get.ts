import { suggestCategoryQuerySchema } from '#shared/schemas/transaction'

export default defineEventHandler(async (event) => {
  // ?type=expense&name=Lidl → the category a new transaction of that type
  // and name would take if created without one, and why; the service
  // authorizes `read`.
  const query = await getValidatedQuery(event, suggestCategoryQuerySchema.parse)
  return suggestCategory(event, query)
})
