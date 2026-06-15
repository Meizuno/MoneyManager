import { getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category id' })
  }
  await deleteExpenseCategory(event, id)
  return { ok: true }
})
