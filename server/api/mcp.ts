import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { getHeader } from 'h3'
import { registerTransactionTools } from '../utils/mcp/transactions'
import { registerExpenseCategoryTools } from '../utils/mcp/expense-categories'
import { registerIncomeCategoryTools } from '../utils/mcp/income-categories'

// MCP endpoint. Two auth paths:
//   - Trusted service: x-api-key matches NUXT_MCP_API_KEY plus an
//     x-user-id header → bypass session auth, use the header user.
//   - Browser session: fall through to the standard cookie-based
//     authenticate(), so the same URL works for direct access.
// Every tool runs in the context of `userId`, which is what the
// scoped data-access utilities expect as the viewer id.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = getHeader(event, 'x-api-key')
  const headerUserId = getHeader(event, 'x-user-id')

  let userId: string
  if (config.mcpApiKey && apiKey === config.mcpApiKey && headerUserId) {
    userId = headerUserId
  }
  else {
    // The auth middleware skips /api/mcp (trusted callers shouldn't
    // pay a validate-roundtrip for nothing), so call authenticate()
    // explicitly for the session path.
    const user = await authenticate(event)
    if (!user) throw new Unauthorized()
    userId = user.id
  }

  const db = getPrisma()
  const server = new McpServer({ name: 'money-manager', version: '1.0.0' })

  // Category-mutating tools are off unless explicitly enabled — the
  // server, not a prompt note, decides whether the model may create or
  // delete categories.
  const allowCategoryMutations = config.mcpAllowCategoryMutations === true

  registerTransactionTools(server, db, userId)
  registerExpenseCategoryTools(server, db, userId, allowCategoryMutations)
  registerIncomeCategoryTools(server, db, userId, allowCategoryMutations)

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)

  const body = event.node.req.method === 'POST' ? await readBody(event) : undefined
  await transport.handleRequest(event.node.req, event.node.res, body)
})
