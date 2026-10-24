import type { H3Event } from 'h3'
import type { ListTransactionsQuery } from '#shared/schemas/transaction'
import type { OverviewResponse } from '#shared/schemas/overview'
import { authorize } from '../utils/principal'
import { addMonths, monthOf } from '#shared/utils/months'
import { listTransactionsScoped, monthlyTotalsScoped, summarizeTransactionsScoped } from '../utils/transactions'
import { listExpenseCategoriesScoped } from '../utils/expense-categories'
import { listIncomeCategoriesScoped } from '../utils/income-categories'

// Backend-for-frontend for the overview page: authorize the `read` scope
// once, then run the reads in parallel in-process. This replaces the
// page's SSR fan-out (list + summary + two category endpoints), each of
// which was a full Nitro round-trip with its own auth + parse.
export async function getOverview(event: H3Event, query: ListTransactionsQuery): Promise<OverviewResponse> {
  const { userId } = await authorize(event, 'read')
  // The trend ends with the period: browsing back to March shows the year
  // up to March. Unfiltered by category/type, unlike the rest.
  const lastMonth = monthOf(query.dateTo ?? new Date().toISOString())
  const [items, summary, splitRules, incomeCategories, trend] = await Promise.all([
    listTransactionsScoped(userId, query),
    summarizeTransactionsScoped(userId, query),
    listExpenseCategoriesScoped(userId),
    listIncomeCategoriesScoped(userId),
    monthlyTotalsScoped(userId, addMonths(lastMonth, -11), lastMonth)
  ])
  return { items, summary, splitRules, incomeCategories, trend }
}
