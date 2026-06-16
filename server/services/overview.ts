import type { H3Event } from 'h3'
import type { ListTransactionsQuery } from '#shared/schemas/transaction'
import type { OverviewResponse } from '#shared/schemas/overview'
import { authorize } from '../utils/principal'
import { listTransactionsScoped, summarizeTransactionsScoped } from '../utils/transactions'
import { listExpenseCategoriesScoped } from '../utils/expense-categories'
import { listIncomeCategoriesScoped } from '../utils/income-categories'

// Backend-for-frontend for the overview page: authorize the `read` scope
// once, then run the four reads in parallel in-process. This replaces the
// page's SSR fan-out (list + summary + two category endpoints), each of
// which was a full Nitro round-trip with its own auth + parse.
export async function getOverview(event: H3Event, query: ListTransactionsQuery): Promise<OverviewResponse> {
  const { userId } = await authorize(event, 'read')
  const [items, summary, splitRules, incomeCategories] = await Promise.all([
    listTransactionsScoped(userId, query),
    summarizeTransactionsScoped(userId, query),
    listExpenseCategoriesScoped(userId),
    listIncomeCategoriesScoped(userId)
  ])
  return { items, summary, splitRules, incomeCategories }
}
