import type { H3Event } from 'h3'
import { createError } from 'h3'
import type { CreateRecurringInput, UpdateRecurringInput } from '#shared/schemas/recurring'
import { authorize } from '../utils/principal'
import {
  createRecurringScoped,
  deleteRecurringScoped,
  listRecurringScoped,
  scheduleToday,
  updateRecurringScoped
} from '../utils/recurring'

// HTTP use-cases for recurring transactions. Listing is a `read`; making,
// changing and deleting one are structural — a rule writes transactions on
// its own for as long as it lives — so full-access only, as with
// categories (no scope argument → PATs are denied by default).

export async function listRecurring(event: H3Event) {
  const { userId } = await authorize(event, 'read')
  return listRecurringScoped(userId)
}

export async function createRecurring(event: H3Event, input: CreateRecurringInput) {
  const { userId } = await authorize(event)
  return createRecurringScoped(userId, input, scheduleToday())
}

export async function updateRecurring(event: H3Event, id: number, input: UpdateRecurringInput) {
  const { userId } = await authorize(event)
  if (Object.values(input).every(v => v === undefined)) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  return updateRecurringScoped(userId, id, input, scheduleToday())
}

export async function deleteRecurring(event: H3Event, id: number) {
  const { userId } = await authorize(event)
  return deleteRecurringScoped(userId, id)
}
