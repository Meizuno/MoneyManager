import { reorderExpenseCategoriesSchema } from '#shared/schemas/expense-category'

// PUT /api/sales-split/reorder — persist a new ordering of the split rules.
// Static path, so it wins over [id].put.ts. Returns the reordered list in the
// same `{ rules }` envelope as the GET.
export default defineEventHandler(async (event) => {
  const { ids } = await readValidatedBody(event, reorderExpenseCategoriesSchema.parse)
  return { rules: await reorderExpenseCategories(event, ids) }
})
