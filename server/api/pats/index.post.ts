import { createPatSchema } from '#shared/schemas/pat'

// Create a PAT (full-access only). The raw token is returned exactly
// ONCE here — only its hash is stored, so it can never be recovered.
export default defineEventHandler(async (event) => {
  const input = await readValidatedBody(event, createPatSchema.parse)
  const { token, pat } = await createPat(event, input)
  return { token, pat }
})
