import type { H3Event } from 'h3'
import type { ListTransactionsQuery } from '#shared/schemas/transaction'
import type { OverviewResponse } from '#shared/schemas/overview'
import { authorize } from '../utils/principal'
import { addMonths, monthOf } from '#shared/utils/months'
import { listTransactionsScoped, monthlyTotalsScoped, summarizeItems } from '../utils/transactions'
import { listExpenseCategoriesScoped } from '../utils/expense-categories'
import { listIncomeCategoriesScoped } from '../utils/income-categories'

// Backend-for-frontend for the overview page: authorize the `read` scope
// once, then run the reads in parallel in-process. This replaces the
// page's SSR fan-out (list + summary + two category endpoints), each of
// which was a full Nitro round-trip with its own auth + parse.
//
// Five queries: the rows of both tables, both category lists — whose
// labels the rows are resolved against, rather than read a second time —
// and the trend. The summary is added up from the rows, which are already
// here, instead of being aggregated again in the database.
export async function getOverview(event: H3Event, query: ListTransactionsQuery): Promise<OverviewResponse> {
  const { userId } = await authorize(event, 'read')
  // The trend ends with the period: browsing back to March shows the year
  // up to March. Unfiltered by category/type, unlike the rest.
  const lastMonth = monthOf(query.dateTo ?? new Date().toISOString())
  const categories = Promise.all([listExpenseCategoriesScoped(userId), listIncomeCategoriesScoped(userId)])
  const labels = categories.then(([expense, income]) => ({
    expense: new Map(expense.map(c => [c.id, c.label])),
    income: new Map(income.map(c => [c.id, c.label]))
  }))
  const [items, [splitRules, incomeCategories], trend] = await Promise.all([
    listTransactionsScoped(userId, query, labels),
    categories,
    monthlyTotalsScoped(userId, addMonths(lastMonth, -11), lastMonth)
  ])
  return { items, summary: summarizeItems(items), splitRules, incomeCategories, trend }
}
