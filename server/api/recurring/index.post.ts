import { createRecurringSchema } from '#shared/schemas/recurring'

export default defineEventHandler(async (event) => {
  const input = await readValidatedBody(event, createRecurringSchema.parse)
  return createRecurring(event, input)
})
