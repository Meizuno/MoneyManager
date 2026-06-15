import type { H3Event } from 'h3'
import { createError } from 'h3'
import type {
  CreateIncomeCategoryInput,
  UpdateIncomeCategoryInput
} from '#shared/schemas/income-category'
import { authorize } from '../utils/principal'
import {
  createIncomeCategoryScoped,
  deleteIncomeCategoryScoped,
  listIncomeCategoriesScoped,
  updateIncomeCategoryScoped
} from '../utils/income-categories'

// HTTP use-cases for the IncomeCategory resource. Listing is a `read`
// scope; every mutation is structural and therefore full-access only
// (no scope argument → PATs are denied by default).

export async function listIncomeCategories(event: H3Event) {
  const { userId } = await authorize(event, 'read')
  return listIncomeCategoriesScoped(userId)
}

export async function createIncomeCategory(event: H3Event, input: CreateIncomeCategoryInput) {
  const { userId } = await authorize(event)
  return createIncomeCategoryScoped(userId, input)
}

export async function updateIncomeCategory(event: H3Event, id: number, input: UpdateIncomeCategoryInput) {
  const { userId } = await authorize(event)
  // zod allows the empty object (every field optional); a PUT with no
  // updatable fields is a client mistake, not a no-op. Surface as 400.
  if (Object.keys(input).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  return updateIncomeCategoryScoped(userId, id, input)
}

export async function deleteIncomeCategory(event: H3Event, id: number) {
  const { userId } = await authorize(event)
  return deleteIncomeCategoryScoped(userId, id)
}
