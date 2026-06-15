import { createHash, randomBytes } from 'node:crypto'
import { getPrisma } from './db'
import { PatNotFound } from './errors'
import { isScope, type Principal, type Scope } from './scopes'

// Personal access token data-access. Only the sha256 hash of a token is
// ever stored; the raw `mm_pat_…` value is returned to the caller once
// at creation and never persisted or logged.

// The prefix lets resolvePrincipal tell a PAT from a JWT before doing
// any work, and lets us reject a JWT-shaped value early.
export const PAT_PREFIX = 'mm_pat_'

/** sha256(token) as lowercase hex — the only form we store / look up by. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/** A fresh opaque token: `mm_pat_` + base64url(32 random bytes). */
export function generateRawToken(): string {
  return PAT_PREFIX + randomBytes(32).toString('base64url')
}

// Wire/summary shape — everything about a token EXCEPT its hash. Never
// expose token_hash (or the raw token, which we don't even have).
export type PatSummary = {
  id: string
  name: string
  scopes: Scope[]
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

function toSummary(row: {
  id: string
  name: string
  scopes: string[]
  created_at: Date
  last_used_at: Date | null
  expires_at: Date | null
}): PatSummary {
  return {
    id: row.id,
    name: row.name,
    scopes: row.scopes.filter(isScope),
    created_at: row.created_at.toISOString(),
    last_used_at: row.last_used_at ? row.last_used_at.toISOString() : null,
    expires_at: row.expires_at ? row.expires_at.toISOString() : null
  }
}

// Create a token for the viewer. Returns the raw token (shown ONCE) plus
// the stored summary. The raw value exists only in this return — only
// its hash is written.
export async function createPatScoped(
  viewerId: string,
  name: string,
  scopes: Scope[],
  expiresAt?: Date | null
): Promise<{ token: string, pat: PatSummary }> {
  const token = generateRawToken()
  const row = await getPrisma().personalAccessToken.create({
    data: {
      user_id: viewerId,
      name,
      token_hash: hashToken(token),
      scopes,
      expires_at: expiresAt ?? null
    }
  })
  return { token, pat: toSummary(row) }
}

// List the viewer's tokens (active + revoked), newest first. Hash never
// leaves the data layer.
export async function listPatsScoped(viewerId: string): Promise<PatSummary[]> {
  const rows = await getPrisma().personalAccessToken.findMany({
    where: { user_id: viewerId, revoked_at: null },
    orderBy: { created_at: 'desc' }
  })
  return rows.map(toSummary)
}

// Revoke (soft-delete) a token, scoped to the owner. The user_id filter
// rides in the where so a stranger holding an id can't revoke another
// user's token. Throws PatNotFound when nothing active matched.
export async function revokePatScoped(viewerId: string, id: string): Promise<{ revoked: string }> {
  const { count } = await getPrisma().personalAccessToken.updateMany({
    where: { id, user_id: viewerId, revoked_at: null },
    data: { revoked_at: new Date() }
  })
  if (count === 0) throw new PatNotFound(id)
  return { revoked: id }
}

// Resolve a raw token to a Principal, or null when it isn't a usable
// PAT (wrong shape, unknown, revoked, or expired). Bumps last_used_at on
// success. Returns the granted scopes — never 'all'; a PAT cannot be
// full access.
export async function resolvePatPrincipal(rawToken: string): Promise<Principal | null> {
  if (!rawToken.startsWith(PAT_PREFIX)) return null
  const db = getPrisma()
  const row = await db.personalAccessToken.findUnique({
    where: { token_hash: hashToken(rawToken) }
  })
  if (!row) return null
  if (row.revoked_at) return null
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) return null

  await db.personalAccessToken.update({
    where: { id: row.id },
    data: { last_used_at: new Date() }
  })
  return { userId: row.user_id, scopes: row.scopes.filter(isScope) }
}
