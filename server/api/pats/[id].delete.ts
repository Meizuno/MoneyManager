import { getRouterParam } from 'h3'

// Revoke a PAT by id (full-access only), scoped to the owner.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid token id' })
  }
  return revokePat(event, id)
})
