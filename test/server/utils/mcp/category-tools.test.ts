import { describe, it, expect } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PrismaClient } from '@prisma/client'
import { registerExpenseCategoryTools } from '../../../../server/utils/mcp/expense-categories'
import { registerIncomeCategoryTools } from '../../../../server/utils/mcp/income-categories'

// Capture the tool names a register call advertises, without a real
// MCP server. registerTool's handler is never invoked here, so the
// PrismaClient can be a stub.
function collectTools(register: (s: McpServer, db: PrismaClient, userId: string, allow?: boolean) => void, allow?: boolean) {
  const names: string[] = []
  const server = { registerTool: (name: string) => { names.push(name) } } as unknown as McpServer
  register(server, {} as PrismaClient, 'u1', allow)
  return names
}

const EXPENSE_MUTATORS = ['add_expense_category', 'update_expense_category', 'remove_expense_category']
const INCOME_MUTATORS = ['add_income_category', 'update_income_category', 'remove_income_category']

describe('category tool gating', () => {
  it('omits expense mutators by default (no flag)', () => {
    const names = collectTools(registerExpenseCategoryTools)
    expect(names).toContain('get_expense_categories')
    expect(names).toContain('get_expense_category_preview')
    for (const m of EXPENSE_MUTATORS) expect(names).not.toContain(m)
  })

  it('omits expense mutators when the flag is false', () => {
    const names = collectTools(registerExpenseCategoryTools, false)
    for (const m of EXPENSE_MUTATORS) expect(names).not.toContain(m)
  })

  it('registers expense mutators when the flag is true', () => {
    const names = collectTools(registerExpenseCategoryTools, true)
    for (const m of EXPENSE_MUTATORS) expect(names).toContain(m)
  })

  it('omits income mutators by default but keeps the read tool', () => {
    const names = collectTools(registerIncomeCategoryTools)
    expect(names).toContain('get_income_categories')
    for (const m of INCOME_MUTATORS) expect(names).not.toContain(m)
  })

  it('registers income mutators when the flag is true', () => {
    const names = collectTools(registerIncomeCategoryTools, true)
    for (const m of INCOME_MUTATORS) expect(names).toContain(m)
  })
})
