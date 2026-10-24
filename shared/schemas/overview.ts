import type { MonthTotals, Transaction, TransactionSummary } from './transaction'
import type { ExpenseCategory } from './expense-category'
import type { IncomeCategory } from './income-category'

// Everything the overview page needs in a single response, so SSR makes
// one /api/overview request (resolved in-process with parallel queries)
// instead of fanning out to the list, summary, and two category
// endpoints. Mirrors the per-resource endpoints' shapes so the granular
// routes stay the source of truth for other pages / PAT consumers.
//
// `trend` is the twelve months ending with the period's last month (the
// month of `dateTo`, or the current month when there is none), oldest
// first — the overview's month-by-month chart.
export type OverviewResponse = {
  items: Transaction[]
  summary: TransactionSummary
  splitRules: ExpenseCategory[]
  incomeCategories: IncomeCategory[]
  trend: MonthTotals[]
}
