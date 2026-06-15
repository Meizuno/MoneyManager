import { describe, it, expect } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PrismaClient } from '@prisma/client'
import { registerTransactionTools } from '../../../../server/utils/mcp/transactions'
import { Forbidden } from '../../../../server/utils/errors'
import type { Principal } from '../../../../server/utils/scopes'

type Handler = (args: Record<string, unknown>) => Promise<unknown>

// Capture name → handler so we can assert both the advertised set and
// the execute-time guard.
function collect(principal: Principal) {
  const tools = new Map<string, Handler>()
  const server = {
    registerTool: (name: string, _def: unknown, handler: Handler) => { tools.set(name, handler) }
  } as unknown as McpServer
  registerTransactionTools(server, {} as PrismaClient, principal)
  return tools
}

const names = (p: Principal) => [...collect(p).keys()].sort()

describe('transaction tool gating by scope', () => {
  it('read PAT advertises reads only', () => {
    expect(names({ userId: 'u', scopes: ['read'] })).toEqual(['get_summary', 'list_transactions'])
  })

  it('add PAT advertises create only', () => {
    expect(names({ userId: 'u', scopes: ['add'] })).toEqual(['create_transaction'])
  })

  it('read+add PAT advertises reads and create, never update/delete', () => {
    expect(names({ userId: 'u', scopes: ['read', 'add'] }))
      .toEqual(['create_transaction', 'get_summary', 'list_transactions'])
  })

  it('full access advertises every tool', () => {
    expect(names({ userId: 'u', scopes: 'all' })).toEqual([
      'create_transaction', 'delete_transaction', 'get_summary', 'list_transactions', 'update_transaction'
    ])
  })
})

describe('execute-time scope guard (defense in depth)', () => {
  it('rejects an out-of-scope call even if the tool was registered', async () => {
    // Register with full access so update_transaction exists, then narrow
    // the (closed-over) principal's scopes: the handler must re-check and
    // refuse before any data-access runs.
    const principal: Principal = { userId: 'u', scopes: 'all' }
    const tools = collect(principal)
    const update = tools.get('update_transaction')!

    principal.scopes = ['read']
    await expect(update({ id: 1, name: 'x' })).rejects.toBeInstanceOf(Forbidden)
  })
})
