import type { H3Event } from 'h3'
import { createError } from 'h3'
import type {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput
} from '#shared/schemas/expense-category'
import { requireAuthUser } from '../utils/auth'
import {
  createExpenseCategoryScoped,
  deleteExpenseCategoryScoped,
  listExpenseCategoriesScoped,
  updateExpenseCategoryScoped
} from '../utils/expense-categories'

// HTTP use-cases for the ExpenseCategory (sales-split rule) resource.
// Same shape as income-categories — thin wrappers that gate on auth
// and forward to the shared data-access utils.

export async function listExpenseCategories(event: H3Event) {
  const user = await requireAuthUser(event)
  return listExpenseCategoriesScoped(user.id)
}

export async function createExpenseCategory(event: H3Event, input: CreateExpenseCategoryInput) {
  const user = await requireAuthUser(event)
  return createExpenseCategoryScoped(user.id, input)
}

export async function updateExpenseCategory(event: H3Event, id: number, input: UpdateExpenseCategoryInput) {
  const user = await requireAuthUser(event)
  // PUT with no updatable fields is a client mistake — surface as 400.
  if (Object.keys(input).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  return updateExpenseCategoryScoped(user.id, id, input)
}

export async function deleteExpenseCategory(event: H3Event, id: number) {
  const user = await requireAuthUser(event)
  return deleteExpenseCategoryScoped(user.id, id)
}
