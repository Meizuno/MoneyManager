export default defineEventHandler(async (event) => {
  // Returns the category array directly (no wrapper) — consistent with
  // the income-categories endpoint. This is the endpoint the iPhone
  // shortcut calls.
  return listExpenseCategories(event)
})
