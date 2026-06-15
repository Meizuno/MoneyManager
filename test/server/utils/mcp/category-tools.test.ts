import { describe, it, expect } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PrismaClient } from '@prisma/client'
import { registerExpenseCategoryTools } from '../../../../server/utils/mcp/expense-categories'
import { registerIncomeCategoryTools } from '../../../../server/utils/mcp/income-categories'
import type { Principal } from '../../../../server/utils/scopes'

// Capture the tool names a register call advertises for a given
// principal, without a real MCP server. The handler is never invoked
// here, so the PrismaClient can be a stub.
type Register = (s: McpServer, db: PrismaClient, principal: Principal) => void
function collectTools(register: Register, principal: Principal) {
  const names: string[] = []
  const server = { registerTool: (name: string) => { names.push(name) } } as unknown as McpServer
  register(server, {} as PrismaClient, principal)
  return names
}

const READ: Principal = { userId: 'u', scopes: ['read'] }
const ADD: Principal = { userId: 'u', scopes: ['add'] }
const ALL: Principal = { userId: 'u', scopes: 'all' }

const EXPENSE_READ = ['get_expense_categories', 'get_expense_category_preview']
const EXPENSE_MUTATORS = ['add_expense_category', 'update_expense_category', 'remove_expense_category']
const INCOME_MUTATORS = ['add_income_category', 'update_income_category', 'remove_income_category']

describe('expense category tool gating by scope', () => {
  it('read PAT: read tools only, never the mutators', () => {
    const names = collectTools(registerExpenseCategoryTools, READ)
    for (const t of EXPENSE_READ) expect(names).toContain(t)
    for (const m of EXPENSE_MUTATORS) expect(names).not.toContain(m)
  })

  it('add-only PAT: not even the read tools (no read scope)', () => {
    const names = collectTools(registerExpenseCategoryTools, ADD)
    for (const t of EXPENSE_READ) expect(names).not.toContain(t)
    for (const m of EXPENSE_MUTATORS) expect(names).not.toContain(m)
  })

  it('full access: read tools AND mutators', () => {
    const names = collectTools(registerExpenseCategoryTools, ALL)
    for (const t of EXPENSE_READ) expect(names).toContain(t)
    for (const m of EXPENSE_MUTATORS) expect(names).toContain(m)
  })
})

describe('income category tool gating by scope', () => {
  it('read PAT: the read tool only', () => {
    const names = collectTools(registerIncomeCategoryTools, READ)
    expect(names).toContain('get_income_categories')
    for (const m of INCOME_MUTATORS) expect(names).not.toContain(m)
  })

  it('full access: read tool AND mutators', () => {
    const names = collectTools(registerIncomeCategoryTools, ALL)
    expect(names).toContain('get_income_categories')
    for (const m of INCOME_MUTATORS) expect(names).toContain(m)
  })

  it('add-only PAT: nothing (no read, no mutate)', () => {
    const names = collectTools(registerIncomeCategoryTools, ADD)
    expect(names).toEqual([])
  })
})
