import { getHeader } from 'h3'
import type { H3Event } from 'h3'
import { authenticate } from './auth'
import { Unauthorized } from './errors'

/**
 * Authenticate a prompt / MCP request and return the acting user id.
 * Two paths:
 *   - Trusted service: x-api-key matches NUXT_MCP_API_KEY and the
 *     caller passes x-user-id (ai-chat does this).
 *   - Browser session: fall through to a cookie-validated user. The
 *     auth middleware *skips* /api/prompts and /api/mcp paths (so
 *     trusted-service callers don't pay a validate-roundtrip), which
 *     means we have to invoke authenticate() here ourselves for the
 *     session path to work.
 */
export async function getPromptUserId(event: H3Event): Promise<string> {
  const config = useRuntimeConfig()
  const apiKey = getHeader(event, 'x-api-key')
  const headerUserId = getHeader(event, 'x-user-id')

  if (config.mcpApiKey && apiKey === config.mcpApiKey && headerUserId) {
    return headerUserId
  }

  const user = await authenticate(event)
  if (user) return user.id

  throw new Unauthorized()
}
