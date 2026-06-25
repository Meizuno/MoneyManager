import { reorderIncomeCategoriesSchema } from '#shared/schemas/income-category'

// PUT /api/income-categories/reorder — persist a new ordering. Static path,
// so it wins over [id].put.ts. Returns the reordered list (bare array, like
// the GET).
export default defineEventHandler(async (event) => {
  const { ids } = await readValidatedBody(event, reorderIncomeCategoriesSchema.parse)
  return reorderIncomeCategories(event, ids)
})
