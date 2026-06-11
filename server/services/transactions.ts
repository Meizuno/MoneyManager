import type { H3Event } from 'h3'
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  UpdateTransactionInput
} from '#shared/schemas/transaction'
import { requireAuthUser } from '../utils/auth'
import {
  createTransactionScoped,
  deleteTransactionScoped,
  listTransactionsScoped,
  updateTransactionScoped
} from '../utils/transactions'

// HTTP use-cases for the Transaction resource. Thin wrappers over the
// shared, transport-agnostic data-access in ../utils/transactions
// (which owns the user_id scope + routing between income/expense
// tables). These add the HTTP auth gate and pass the viewer.

export async function createTransaction(event: H3Event, input: CreateTransactionInput) {
  const user = await requireAuthUser(event)
  return createTransactionScoped(user.id, input)
}

export async function updateTransaction(event: H3Event, id: number, input: UpdateTransactionInput) {
  const user = await requireAuthUser(event)
  return updateTransactionScoped(user.id, id, input)
}

export async function deleteTransaction(event: H3Event, id: number) {
  const user = await requireAuthUser(event)
  return deleteTransactionScoped(user.id, id)
}

export async function listTransactions(event: H3Event, query: ListTransactionsQuery) {
  const user = await requireAuthUser(event)
  return listTransactionsScoped(user.id, query)
}
