import { describe, it, expect } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PrismaClient } from '@prisma/client'
import { registerRecurringTools } from '../../../../server/utils/mcp/recurring'
import type { Principal } from '../../../../server/utils/scopes'

// A rule writes transactions by itself for as long as it lives, so making,
// changing and deleting one is full-access only — a PAT can list them at
// most.
function names(principal: Principal) {
  const tools: string[] = []
  const server = { registerTool: (name: string) => { tools.push(name) } } as unknown as McpServer
  registerRecurringTools(server, {} as PrismaClient, principal)
  return tools.sort()
}

describe('recurring tool gating by scope', () => {
  it('a read PAT can list them', () => {
    expect(names({ userId: 'u', scopes: ['read'] })).toEqual(['list_recurring_transactions'])
  })

  it('an add PAT gets nothing', () => {
    expect(names({ userId: 'u', scopes: ['add'] })).toEqual([])
  })

  it('full access gets all four', () => {
    expect(names({ userId: 'u', scopes: 'all' })).toEqual([
      'create_recurring_transaction', 'delete_recurring_transaction', 'list_recurring_transactions', 'update_recurring_transaction'
    ])
  })
})
