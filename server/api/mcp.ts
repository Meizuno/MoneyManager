import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerTransactionTools } from '../utils/mcp/transactions'
import { registerExpenseCategoryTools } from '../utils/mcp/expense-categories'
import { registerIncomeCategoryTools } from '../utils/mcp/income-categories'
import { resolvePrincipal } from '../utils/principal'

// MCP endpoint. Authenticates ONLY via a PAT (Authorization: Bearer
// mm_pat_…), a Bearer JWT, or the session cookie — never a
// caller-asserted user id. resolvePrincipal throws 401 when no valid
// credential is present (the old x-api-key + x-user-id path is gone).
//
// The principal's scopes drive tool registration: each register fn
// advertises only the tools the scopes permit, and every tool re-checks
// scope at execute time (defense in depth). A PAT therefore can never
// see — let alone run — update/delete or any category-mutation tool;
// those are full-access only.
export default defineEventHandler(async (event) => {
  const principal = await resolvePrincipal(event)

  const db = getPrisma()
  const server = new McpServer({ name: 'money-manager', version: '1.0.0' })

  registerTransactionTools(server, db, principal)
  registerExpenseCategoryTools(server, db, principal)
  registerIncomeCategoryTools(server, db, principal)

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)

  const body = event.node.req.method === 'POST' ? await readBody(event) : undefined
  await transport.handleRequest(event.node.req, event.node.res, body)
})
