// The scope layer shared by the HTTP API and the MCP surface.
//
// Principal model:
//   - A validated session / JWT is FULL access — `scopes: 'all'`.
//   - A personal access token (PAT) is limited to the scopes it holds.
//
// Today's scopes are `read` and `add`. Anything destructive or
// structural (update, delete, any category mutation, PAT management) is
// full-access only and is expressed by requiring an *unassigned* scope —
// see requireScope's default-deny rule below.

export const SCOPES = ['read', 'add'] as const
export type Scope = (typeof SCOPES)[number]

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value)
}

export type Principal = {
  userId: string
  // 'all' = full access (session/JWT). Otherwise the PAT's granted scopes.
  scopes: Scope[] | 'all'
}

/**
 * Can `principal` perform an operation guarded by `scope`?
 *
 * DEFAULT-DENY: a full-access principal can do anything; a PAT can do an
 * operation only if it holds the named scope. An operation with NO scope
 * assigned (`scope` omitted) is full-access only — no PAT scope grants
 * it. This is what keeps update/delete/category-mutation/PAT-management
 * off-limits to tokens, and makes any new, unannotated operation safe by
 * construction.
 */
export function requireScope(principal: Principal, scope?: Scope): boolean {
  if (principal.scopes === 'all') return true
  if (!scope) return false
  return principal.scopes.includes(scope)
}
