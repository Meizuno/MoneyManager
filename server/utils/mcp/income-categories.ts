import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod/v3'
import {
  createIncomeCategoryScoped,
  deleteIncomeCategoryScoped,
  listIncomeCategoriesScoped,
  updateIncomeCategoryScoped
} from '../income-categories'
import { Forbidden } from '../errors'
import { requireScope, type Principal, type Scope } from '../scopes'
import { toJson } from './helpers'

// MCP tools for income categories. Same shape as the HTTP service —
// all persistence flows through ../income-categories so the user_id
// scope, the auto-colour assignment, and the typed
// IncomeCategoryNotFound exist in exactly one place.
//
// Scope gating mirrors the expense-category twin: the read tool needs
// `read`; mutations are full-access only (no PAT scope grants them).
// `db` is unused but kept in the signature to match the sibling
// register functions and the api/mcp.ts call site.
export function registerIncomeCategoryTools(server: McpServer, _db: PrismaClient, principal: Principal) {
  const userId = principal.userId
  const can = (scope?: Scope) => requireScope(principal, scope)
  const guard = (scope?: Scope) => { if (!requireScope(principal, scope)) throw new Forbidden() }

  if (can('read')) {
    server.registerTool(
      'get_income_categories',
      {
        description: 'Return all income categories for the current user. Each category has id, label, and color. Use the id as transaction.category when creating or filtering income transactions. No parameters required.',
        inputSchema: z.object({})
      },
      async () => {
        guard('read')
        const categories = await listIncomeCategoriesScoped(userId)
        return toJson(categories)
      }
    )
  }

  // Category mutations are full-access only — never advertised to a PAT.
  if (!can()) return

  server.registerTool(
    'add_income_category',
    {
      description: `Create a new income category. Color is assigned automatically based on position.
Required: label.
The returned id is used as transaction.category when creating income transactions.`,
      inputSchema: z.object({
        label: z.string().describe('(required) Category name, e.g. Salary, Freelance, Interest, Dividends.')
      })
    },
    async ({ label }) => {
      guard()
      const category = await createIncomeCategoryScoped(userId, { label })
      return toJson(category)
    }
  )

  server.registerTool(
    'update_income_category',
    {
      description: 'Update the label of an existing income category by its id. Required: id, label.',
      inputSchema: z.object({
        id: z.number().int().describe('(required) ID of the income category to update.'),
        label: z.string().describe('(required) New category name.')
      })
    },
    async ({ id, label }) => {
      guard()
      const category = await updateIncomeCategoryScoped(userId, id, { label })
      return toJson(category)
    }
  )

  server.registerTool(
    'remove_income_category',
    {
      description: 'Delete an income category by its id. Required: id.',
      inputSchema: z.object({
        id: z.number().int().describe('(required) ID of the income category to delete.')
      })
    },
    async ({ id }) => {
      guard()
      const result = await deleteIncomeCategoryScoped(userId, id)
      return toJson(result)
    }
  )
}
