import type { H3Event } from 'h3'
import { authorize } from './principal'

/**
 * Authenticate a prompt request and return the acting user id. Prompts
 * expose read-only financial data, so they require the `read` scope —
 * a session/JWT (full access) or a PAT that holds `read`. The legacy
 * x-api-key + x-user-id path is gone; identity is never caller-asserted.
 *
 * The auth middleware skips /api/* (auth is per-operation), so the
 * principal is resolved here.
 */
export async function getPromptUserId(event: H3Event): Promise<string> {
  const { userId } = await authorize(event, 'read')
  return userId
}
