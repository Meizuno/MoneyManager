export default defineEventHandler(async (event) => {
  const categories = await listIncomeCategories(event)
  return { categories }
})
