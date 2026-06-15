export default defineEventHandler(async (event) => {
  const categories = await listExpenseCategories(event)
  return { categories }
})
