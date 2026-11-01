import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod/v3'
import {
  createRecurringScoped,
  deleteRecurringScoped,
  listRecurringScoped,
  scheduleToday,
  updateRecurringScoped
} from '../recurring'
import { Forbidden } from '../errors'
import { requireScope, type Principal, type Scope } from '../scopes'
import { optCategoryId, optStr, toJson } from './helpers'
import { toCategoryId } from './transactions'

// MCP tools for recurring transactions — rules that write an income or an
// expense every N days, weeks, months or years. All persistence goes
// through ../recurring, the same as the HTTP API.
//
// Scope gating mirrors the categories: listing needs `read`; making,
// changing and deleting a rule are full-access only — a rule writes
// transactions by itself for as long as it lives, which is more than a
// PAT's `add` was ever meant to grant.
export function registerRecurringTools(server: McpServer, _db: PrismaClient, principal: Principal) {
  const userId = principal.userId
  const can = (scope?: Scope) => requireScope(principal, scope)
  const guard = (scope?: Scope) => { if (!requireScope(principal, scope)) throw new Forbidden() }

  if (can('read')) {
    server.registerTool(
      'list_recurring_transactions',
      {
        description: `Return the user's recurring transactions: rules that write an income or an expense automatically every N days, weeks, months or years.
Each has id, type, name, amount, currency, category {id, label}, unit (day | week | month | year), every, start_date, end_date (null: no end), next_date (the next one to be written; null once the end date has passed) and paused. The transactions they write carry recurring_id. No parameters required.`,
        inputSchema: z.object({})
      },
      async () => {
        guard('read')
        return toJson(await listRecurringScoped(userId))
      }
    )
  }

  if (!can()) return

  server.registerTool(
    'create_recurring_transaction',
    {
      description: `Create a recurring transaction: an income or an expense written automatically every \`every\` \`unit\`s from start_date, until end_date if given. Occurrences already due (start_date today or earlier) are written at once.
Monthly and yearly ones keep the day of start_date; where a month is shorter they fall on its last day.
Required: type, name, amount, unit, start_date. Optional: every (default 1), end_date, currency (defaults to CZK), category — omit it to use the category of the last transaction with this name, else the default category; if neither exists the call fails.`,
      inputSchema: z.object({
        type: z.enum(['income', 'expense']).describe("(required) 'income' or 'expense'."),
        name: z.string().describe('(required) Name of each transaction, e.g. Rent.'),
        amount: z.number().positive().describe('(required) Amount of each occurrence, positive.'),
        unit: z.enum(['day', 'week', 'month', 'year']).describe('(required) The unit of the interval.'),
        every: z.number().int().min(1).optional().describe('(optional) Every how many units; 1 when omitted. every 2 with unit week is fortnightly.'),
        start_date: z.string().describe('(required) The first occurrence, YYYY-MM-DD.'),
        end_date: optStr.describe('(optional) The last day it may fall on, YYYY-MM-DD. Omit for no end.'),
        currency: optStr.describe('(optional) 3-letter ISO currency code; CZK when omitted.'),
        category: optCategoryId.describe('(optional) An existing category ID matching the type. Omit to reuse the category of the last transaction with this name, else the default category.')
      })
    },
    async ({ type, name, amount, unit, every, start_date, end_date, currency, category }) => {
      guard()
      const item = await createRecurringScoped(userId, {
        type,
        name: name.trim(),
        amount,
        unit,
        every: every ?? 1,
        start_date,
        end_date: end_date ?? null,
        currency: currency ?? null,
        category: toCategoryId(category)
      }, scheduleToday())
      return toJson(item)
    }
  )

  server.registerTool(
    'update_recurring_transaction',
    {
      description: `Change a recurring transaction from now on, or pause / resume it. Transactions it already wrote are not changed. The schedule (unit, every, start_date) cannot be changed — delete it and create another.
Required: id. Optional: name, amount, currency, category, end_date (pass an empty string to remove the end), paused (true pauses; false resumes from the next occurrence on or after today — what fell due while paused is skipped).`,
      inputSchema: z.object({
        id: z.number().int().describe('(required) ID of the recurring transaction.'),
        name: optStr.describe('(optional) New name.'),
        amount: z.number().positive().optional().describe('(optional) New amount.'),
        currency: optStr.describe('(optional) New 3-letter currency code.'),
        category: optCategoryId.describe('(optional) New category ID matching its type.'),
        end_date: z.string().optional().describe('(optional) New end date YYYY-MM-DD, or an empty string for none.'),
        paused: z.boolean().optional().describe('(optional) true to pause, false to resume.')
      })
    },
    async ({ id, name, amount, currency, category, end_date, paused }) => {
      guard()
      const item = await updateRecurringScoped(userId, id, {
        name: name?.trim(),
        amount,
        currency,
        category: toCategoryId(category),
        end_date: end_date === undefined ? undefined : end_date || null,
        paused
      }, scheduleToday())
      return toJson(item)
    }
  )

  server.registerTool(
    'delete_recurring_transaction',
    {
      description: 'Delete a recurring transaction by id. The transactions it already wrote stay, as ordinary ones. Required: id.',
      inputSchema: z.object({
        id: z.number().int().describe('(required) ID of the recurring transaction.')
      })
    },
    async ({ id }) => {
      guard()
      return toJson(await deleteRecurringScoped(userId, id))
    }
  )
}
