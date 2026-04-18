import { getHeader, createError } from 'h3'
import type { H3Event } from 'h3'

/** Authenticate prompt request — API key + user ID header or user session */
export function getPromptUserId(event: H3Event): string {
  const config = useRuntimeConfig()
  const apiKey = getHeader(event, 'x-api-key')
  const headerUserId = getHeader(event, 'x-user-id')

  if (config.mcpApiKey && apiKey === config.mcpApiKey && headerUserId) {
    return headerUserId
  }

  const user = event.context.authUser as { id: string } | undefined
  if (user) return user.id

  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
}
