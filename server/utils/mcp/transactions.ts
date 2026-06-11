import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod/v3'
import {
  createTransactionScoped,
  deleteTransactionScoped,
  listTransactionsScoped,
  updateTransactionScoped
} from '../transactions'
import { optStr, optCategoryId, toJson } from './helpers'

// MCP tools for the Transaction resource. All persistence flows
// through the shared scoped data-access in ../transactions, so the
// user_id filter, the income/expense table routing, and the typed
// TransactionNotFound exist in one place. MCP-side responsibility is
// limited to: validate input with zod (the SDK needs zod-v3 grammars
// to advertise the tool), and shape the response body for the LLM.

// optCategoryId's transform yields `string | number | undefined`, but
// the scoped helpers expect a `number | undefined`. Collapse here at
// the boundary so the downstream signature stays clean.
function toCategoryId(v: string | number | undefined): number | undefined {
  if (v === undefined) return undefined
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : 0
  const t = v.trim()
  return /^\d+$/.test(t) ? Number(t) : 0
}

export function registerTransactionTools(server: McpServer, db: PrismaClient, userId: string) {
  server.registerTool(
    'list_transactions',
    {
      description: `List transactions ordered by date descending.
All parameters are optional — omitting a parameter returns all records without that filter.
- type: omit to return both incomes and expenses.
- category: omit to return all categories. Category IDs come from get_expense_categories (for expenses) or get_income_categories (for incomes).
- dateFrom / dateTo: omit either or both to remove the date boundary.`,
      inputSchema: z.object({
        type: z.enum(['income', 'expense']).optional().describe("(optional) Filter by type. Omit or pass empty string to return all transactions regardless of type."),
        category: optCategoryId.describe('(optional) Filter by category ID. Omit or pass empty string to return all categories.'),
        dateFrom: optStr.describe('(optional) Return transactions on or after this date, format YYYY-MM-DD. Omit or pass empty string for no start boundary.'),
        dateTo: optStr.describe('(optional) Return transactions on or before this date, format YYYY-MM-DD. Omit or pass empty string for no end boundary.')
      })
    },
    async ({ type, category, dateFrom, dateTo }) => {
      // listTransactionsScoped is the same function the HTTP handler
      // calls. It owns the dual-table read + date / category filters.
      const items = await listTransactionsScoped(userId, {
        type,
        category: toCategoryId(category),
        dateFrom,
        dateTo
      })
      return toJson(items)
    }
  )

  server.registerTool(
    'get_summary',
    {
      description: 'Get total income, total expenses, and net balance (income minus expenses) across all transactions. No parameters required.',
      inputSchema: z.object({})
    },
    async () => {
      // Aggregation that doesn't map onto a single Prisma helper.
      // Keep it inline; routing it through a service would add no
      // sharing — this query has no other caller.
      const [incomes, expenses] = await Promise.all([
        db.income.findMany({ where: { user_id: userId } }),
        db.expense.findMany({ where: { user_id: userId } })
      ])
      const income = incomes.reduce((sum, i) => sum + Math.abs(Number(i.amount)), 0)
      const expense = expenses.reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0)
      return toJson({ income, expenses: expense, net: income - expense })
    }
  )

  server.registerTool(
    'create_transaction',
    {
      description: `Create a new income or expense transaction.
Required: date, name, amount, type.
Optional: category (ID from get_expense_categories or get_income_categories depending on type), currency (3-letter ISO code, defaults to CZK if omitted).`,
      inputSchema: z.object({
        date: z.string().describe('(required) Date in YYYY-MM-DD format.'),
        name: z.string().describe('(required) Transaction description.'),
        amount: z.number().positive().describe('(required) Amount as a positive number.'),
        type: z.enum(['income', 'expense']).describe("(required) Transaction type: 'income' or 'expense'."),
        category: optCategoryId.describe('(optional) Category ID. Use get_expense_categories or get_income_categories to find valid IDs. Defaults to 0 (uncategorised) if omitted or empty.'),
        currency: optStr.describe('(optional) 3-letter ISO currency code, e.g. CZK, USD, EUR. Omit or pass empty string to leave unset.')
      })
    },
    async ({ date, name, amount, type, category, currency }) => {
      const item = await createTransactionScoped(userId, {
        date,
        name,
        amount,
        type,
        category: toCategoryId(category) ?? 0,
        currency: currency ?? null
      })
      return toJson(item)
    }
  )

  server.registerTool(
    'update_transaction',
    {
      description: `Update one or more fields of an existing transaction by its ID.
Required: id.
Optional: date, name, amount, type, category, currency — only provided fields are updated, the rest stay unchanged.
Changing type moves the record between the incomes and expenses tables and assigns a new ID.`,
      inputSchema: z.object({
        id: z.number().int().describe('(required) ID of the transaction to update.'),
        date: optStr.describe('(optional) New date in YYYY-MM-DD format. Omit or pass empty string to leave unchanged.'),
        name: optStr.describe('(optional) New description. Omit or pass empty string to leave unchanged.'),
        amount: z.number().positive().optional().describe('(optional) New amount as a positive number. Omit to leave unchanged.'),
        type: z.enum(['income', 'expense']).optional().describe('(optional) New type. Changing this moves the record to the other table and assigns a new ID. Omit to leave unchanged.'),
        category: optCategoryId.describe('(optional) New category ID. Use get_expense_categories or get_income_categories to find valid IDs. Omit or pass empty string to leave unchanged.'),
        currency: optStr.nullable().describe('(optional) New 3-letter ISO currency code, or null to clear it. Omit or pass empty string to leave unchanged.')
      })
    },
    async ({ id, date, name, amount, type, category, currency }) => {
      // updateTransactionScoped throws TransactionNotFound if the id
      // isn't in this user's scope — MCP surfaces that as a tool
      // error, which is the right shape for the LLM to react to.
      const item = await updateTransactionScoped(userId, id, {
        date,
        name,
        amount,
        type,
        category: toCategoryId(category),
        currency
      })
      return toJson(item)
    }
  )

  server.registerTool(
    'delete_transaction',
    {
      description: 'Delete a transaction by its ID. Searches both incomes and expenses tables. Required: id.',
      inputSchema: z.object({
        id: z.number().int().describe('(required) ID of the transaction to delete.')
      })
    },
    async ({ id }) => {
      // deleteTransactionScoped throws TransactionNotFound when the
      // id isn't found in either table for this user — replaces the
      // previous silent no-op-on-miss.
      const result = await deleteTransactionScoped(userId, id)
      return toJson(result)
    }
  )
}
