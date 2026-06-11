export default defineEventHandler(async (event) => {
  const rules = await listExpenseCategories(event)
  return { rules }
})
