import type { H3Event } from 'h3'
import { createError } from 'h3'
import type {
  CreateIncomeCategoryInput,
  UpdateIncomeCategoryInput
} from '#shared/schemas/income-category'
import { requireAuthUser } from '../utils/auth'
import {
  createIncomeCategoryScoped,
  deleteIncomeCategoryScoped,
  listIncomeCategoriesScoped,
  updateIncomeCategoryScoped
} from '../utils/income-categories'

// HTTP use-cases for the IncomeCategory resource. Thin wrappers over
// the shared, transport-agnostic data-access in
// ../utils/income-categories. Add the HTTP auth gate and pass the
// viewer; reject the "empty update" case that zod's optional fields
// would otherwise let through.

export async function listIncomeCategories(event: H3Event) {
  const user = await requireAuthUser(event)
  return listIncomeCategoriesScoped(user.id)
}

export async function createIncomeCategory(event: H3Event, input: CreateIncomeCategoryInput) {
  const user = await requireAuthUser(event)
  return createIncomeCategoryScoped(user.id, input)
}

export async function updateIncomeCategory(event: H3Event, id: number, input: UpdateIncomeCategoryInput) {
  const user = await requireAuthUser(event)
  // zod allows the empty object (every field optional); a PUT with no
  // updatable fields is a client mistake, not a no-op. Surface as 400.
  if (Object.keys(input).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  return updateIncomeCategoryScoped(user.id, id, input)
}

export async function deleteIncomeCategory(event: H3Event, id: number) {
  const user = await requireAuthUser(event)
  return deleteIncomeCategoryScoped(user.id, id)
}
