import type { H3Event } from 'h3'
import { createError } from 'h3'
import type {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput
} from '#shared/schemas/expense-category'
import { authorize } from '../utils/principal'
import {
  createExpenseCategoryScoped,
  deleteExpenseCategoryScoped,
  listExpenseCategoriesScoped,
  updateExpenseCategoryScoped
} from '../utils/expense-categories'

// HTTP use-cases for the ExpenseCategory (sales-split rule) resource.
// Listing is a `read` scope; every mutation is structural and therefore
// full-access only (no scope argument → PATs are denied by default).

export async function listExpenseCategories(event: H3Event) {
  const { userId } = await authorize(event, 'read')
  return listExpenseCategoriesScoped(userId)
}

export async function createExpenseCategory(event: H3Event, input: CreateExpenseCategoryInput) {
  const { userId } = await authorize(event)
  return createExpenseCategoryScoped(userId, input)
}

export async function updateExpenseCategory(event: H3Event, id: number, input: UpdateExpenseCategoryInput) {
  const { userId } = await authorize(event)
  // PUT with no updatable fields is a client mistake — surface as 400.
  if (Object.keys(input).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  return updateExpenseCategoryScoped(userId, id, input)
}

export async function deleteExpenseCategory(event: H3Event, id: number) {
  const { userId } = await authorize(event)
  return deleteExpenseCategoryScoped(userId, id)
}
