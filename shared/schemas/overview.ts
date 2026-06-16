import type { Transaction, TransactionSummary } from './transaction'
import type { ExpenseCategory } from './expense-category'
import type { IncomeCategory } from './income-category'

// Everything the overview page needs in a single response, so SSR makes
// one /api/overview request (resolved in-process with parallel queries)
// instead of fanning out to the list, summary, and two category
// endpoints. Mirrors the per-resource endpoints' shapes so the granular
// routes stay the source of truth for other pages / PAT consumers.
export type OverviewResponse = {
  items: Transaction[]
  summary: TransactionSummary
  splitRules: ExpenseCategory[]
  incomeCategories: IncomeCategory[]
}
