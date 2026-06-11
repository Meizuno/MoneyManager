import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod/v3'
import {
  createExpenseCategoryScoped,
  deleteExpenseCategoryScoped,
  listExpenseCategoriesScoped,
  updateExpenseCategoryScoped
} from '../expense-categories'
import { toJson, optStr } from './helpers'

// MCP tools for expense categories (a.k.a. sales-split rules). All
// persistence flows through ../expense-categories so the user_id
// scope, auto-colour assignment, and typed ExpenseCategoryNotFound
// exist in one place.
//
// Pre-refactor, this file shipped two real cross-user bugs:
// `update_expense_category` and `remove_expense_category` called
// `db.expenseCategory.update / .delete` with `where: { id }` only,
// no user_id filter — any caller knowing an id could overwrite or
// delete another user's category. Routing through the scoped utils
// closes that hole atomically.
export function registerExpenseCategoryTools(server: McpServer, db: PrismaClient, userId: string) {
  server.registerTool(
    'get_expense_categories',
    {
      description: 'Return all expense categories for the current user. Each category has id, label, percent, and color. Use the id as transaction.category when creating or filtering expense transactions. No parameters required.',
      inputSchema: z.object({})
    },
    async () => {
      const categories = await listExpenseCategoriesScoped(userId)
      return toJson(categories)
    }
  )

  server.registerTool(
    'add_expense_category',
    {
      description: `Create a new expense category. Color is assigned automatically based on position.
Required: label, percent.
The returned id is used as transaction.category when creating expense transactions.
⚠️ WARNING: This action modifies user data. You MUST explicitly confirm with the user before calling this tool.`,
      inputSchema: z.object({
        label: z.string().describe('(required) Category name, e.g. Taxes, Savings, Rent, Food.'),
        percent: z.number().min(0).max(100).describe('(required) Percentage of income to allocate to this category (0–100).')
      })
    },
    async ({ label, percent }) => {
      const category = await createExpenseCategoryScoped(userId, { label, percent })
      return toJson(category)
    }
  )

  server.registerTool(
    'update_expense_category',
    {
      description: `Update an expense category by its id.
Required: id.
Optional: label, percent — only provided fields are updated, the rest stay unchanged.
⚠️ WARNING: This action modifies user data. You MUST explicitly confirm with the user before calling this tool.`,
      inputSchema: z.object({
        id: z.number().int().describe('(required) ID of the expense category to update.'),
        label: optStr.describe('(optional) New category name. Omit or pass empty string to leave unchanged.'),
        percent: z.number().min(0).max(100).optional().describe('(optional) New allocation percentage (0–100).')
      })
    },
    async ({ id, label, percent }) => {
      const category = await updateExpenseCategoryScoped(userId, id, { label, percent })
      return toJson(category)
    }
  )

  server.registerTool(
    'remove_expense_category',
    {
      description: 'Delete an expense category by its id. Required: id.\n⚠️ WARNING: This action permanently deletes user data. You MUST explicitly confirm with the user before calling this tool.',
      inputSchema: z.object({
        id: z.number().int().describe('(required) ID of the expense category to delete.')
      })
    },
    async ({ id }) => {
      const result = await deleteExpenseCategoryScoped(userId, id)
      return toJson(result)
    }
  )

  server.registerTool(
    'get_expense_category_preview',
    {
      description: 'Show each expense category with its budget allocation amount calculated from total income. Returns totalIncome, totalAllocatedPercent, unallocatedPercent, unallocatedAmount, and a breakdown per category. No parameters required.',
      inputSchema: z.object({})
    },
    async () => {
      // Cross-resource aggregation (incomes × categories). No HTTP
      // analog and no other caller, so kept inline rather than
      // forcing a dedicated service.
      const [incomes, categories] = await Promise.all([
        db.income.findMany({ where: { user_id: userId } }),
        db.expenseCategory.findMany({ where: { user_id: userId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })
      ])
      const totalIncome = incomes.reduce((sum, i) => sum + Math.abs(Number(i.amount)), 0)
      const totalPercent = categories.reduce((s, c) => s + Number(c.percent), 0)
      return toJson({
        totalIncome,
        totalAllocatedPercent: totalPercent,
        unallocatedPercent: Math.max(0, 100 - totalPercent),
        unallocatedAmount: (totalIncome * Math.max(0, 100 - totalPercent)) / 100,
        categories: categories.map(c => ({
          id: c.id,
          label: c.label,
          percent: Number(c.percent),
          amount: (totalIncome * Number(c.percent)) / 100
        }))
      })
    }
  )
}
