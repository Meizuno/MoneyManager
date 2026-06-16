import type { H3Event } from 'h3'
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  UpdateTransactionInput
} from '#shared/schemas/transaction'
import { authorize } from '../utils/principal'
import {
  createTransactionScoped,
  deleteTransactionScoped,
  listTransactionsScoped,
  summarizeTransactionsScoped,
  updateTransactionScoped
} from '../utils/transactions'

// HTTP use-cases for the Transaction resource. Thin wrappers over the
// shared, transport-agnostic data-access in ../utils/transactions
// (which owns the user_id scope + routing between income/expense
// tables). Each use-case names the scope it needs via authorize(); the
// scope is the single source of truth for who may call it. Reads need
// `read`, creates need `add`, and update/delete are full-access only
// (no scope argument → default-deny for PATs).

export async function createTransaction(event: H3Event, input: CreateTransactionInput) {
  const { userId } = await authorize(event, 'add')
  return createTransactionScoped(userId, input)
}

export async function updateTransaction(event: H3Event, id: number, input: UpdateTransactionInput) {
  const { userId } = await authorize(event)
  return updateTransactionScoped(userId, id, input)
}

export async function deleteTransaction(event: H3Event, id: number) {
  const { userId } = await authorize(event)
  return deleteTransactionScoped(userId, id)
}

export async function listTransactions(event: H3Event, query: ListTransactionsQuery) {
  const { userId } = await authorize(event, 'read')
  return listTransactionsScoped(userId, query)
}

export async function summarizeTransactions(event: H3Event, query: ListTransactionsQuery) {
  const { userId } = await authorize(event, 'read')
  return summarizeTransactionsScoped(userId, query)
}
