export default defineEventHandler(async (event) => {
  // Returns the category array directly (no wrapper) — consistent with
  // the expense-categories endpoint.
  return listIncomeCategories(event)
})
