import { getHeader } from 'h3'
import type { H3Event } from 'h3'
import { authenticate } from './auth'
import { Forbidden, Unauthorized } from './errors'
import { PAT_PREFIX, resolvePatPrincipal } from './pats'
import { requireScope, type Principal, type Scope } from './scopes'

// The single auth/scope entry point shared by the HTTP API, the MCP
// surface, and prompts. There is exactly one place that decides "who is
// this and what may they do" — no scattered per-caller checks.

function bearerToken(event: H3Event): string {
  const header = getHeader(event, 'authorization')
  return header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

/**
 * Identify the caller as a Principal, or throw 401.
 *   - `Authorization: Bearer mm_pat_…` → PAT: looked up by hash, rejected
 *     if missing / revoked / expired, last_used_at bumped → scoped principal.
 *   - Otherwise a Bearer JWT or a session cookie, validated exactly as
 *     the app already does → full-access principal.
 *
 * Caller-asserted identity (the old x-api-key + x-user-id path) is gone:
 * a request that supplies only those headers has no valid credential and
 * resolves to 401.
 */
export async function resolvePrincipal(event: H3Event): Promise<Principal> {
  const cached = event.context.principal as Principal | undefined
  if (cached) return cached

  const bearer = bearerToken(event)
  if (bearer.startsWith(PAT_PREFIX)) {
    const pat = await resolvePatPrincipal(bearer)
    if (!pat) throw new Unauthorized()
    event.context.principal = pat
    event.context.user = { id: pat.userId }
    return pat
  }

  const user = await authenticate(event)
  if (!user) throw new Unauthorized()
  const principal: Principal = { userId: user.id, scopes: 'all' }
  event.context.principal = principal
  event.context.user = { id: user.id }
  return principal
}

/**
 * Resolve the principal and assert it holds `scope`, else throw 403.
 * Omitting `scope` marks a full-access-only operation (default-deny).
 * Also bridges the principal's user id onto event.context.user so the
 * existing user-scoped data-access (viewerId / requireAuthUser) keeps
 * working unchanged for both PAT and session callers.
 */
export async function authorize(event: H3Event, scope?: Scope): Promise<Principal> {
  const principal = await resolvePrincipal(event)
  if (!requireScope(principal, scope)) throw new Forbidden()
  event.context.user = { id: principal.userId }
  return principal
}
