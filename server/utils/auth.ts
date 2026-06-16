import { createHash } from 'node:crypto'
import { getCookie, getHeader, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { Unauthorized } from './errors'

export type AuthUser = { id: string }

// Secure cookies everywhere except the dev server (http localhost).
// import.meta.dev is the Nuxt-native signal — avoids reading process.env
// outside the env plugin (per architecture rule).
const isSecure = () => !import.meta.dev

// Short-TTL cache of SUCCESSFUL access-token validations. A single SSR
// page render fans out to several /api calls, each its own H3 event that
// forwards the same mm_access cookie; without this, each would re-hit the
// auth service's /validate. Keyed by sha256(token) so raw tokens aren't
// held in memory, with a few-seconds TTL: long enough to cover one
// render's fan-out, short enough that a revoked/expired token isn't
// honoured meaningfully past its lifetime. Only successes are cached
// (failures fall through to the refresh path every time).
const VALIDATION_TTL_MS = 5_000
const validationCache = new Map<string, { user: AuthUser, expiresAt: number }>()

function tokenKey(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Drop expired entries when the map grows past a small bound, so a long-
// running process doesn't accumulate keys for tokens never seen again.
function pruneValidationCache(now: number): void {
  if (validationCache.size < 1024) return
  for (const [key, entry] of validationCache) {
    if (entry.expiresAt <= now) validationCache.delete(key)
  }
}

/** Test-only: reset the validation cache between cases. */
export function __clearValidationCache(): void {
  validationCache.clear()
}

/**
 * Cache layer around a token validator: returns the cached user on a
 * fresh hit, otherwise runs `validate` and caches a successful result.
 * Failures (null) are not cached. The validator is injected so this core
 * — the dedupe behaviour — is testable without the Nuxt globals that the
 * real `verifyAccessToken` reaches for.
 */
export async function withValidationCache(
  token: string,
  validate: () => Promise<AuthUser | null>
): Promise<AuthUser | null> {
  if (!token) return null

  const key = tokenKey(token)
  const now = Date.now()
  const hit = validationCache.get(key)
  if (hit && hit.expiresAt > now) return hit.user
  if (hit) validationCache.delete(key)

  const user = await validate()
  if (!user) return null
  pruneValidationCache(now)
  validationCache.set(key, { user, expiresAt: now + VALIDATION_TTL_MS })
  return user
}

/**
 * Validate a token string against the auth service, with a short-TTL
 * cache so a single request's SSR fan-out validates only once.
 */
export function verifyAccessToken(token: string): Promise<AuthUser | null> {
  return withValidationCache(token, async () => {
    try {
      const config = useRuntimeConfig()
      const result = await $fetch<{ user_id: string }>(
        `${config.authServiceUrl}/validate`,
        { headers: { authorization: `Bearer ${token}` } }
      )
      return result.user_id ? { id: result.user_id } : null
    }
    catch {
      return null
    }
  })
}

// Read a cookie from the parsed H3 cookies, falling back to the raw
// `cookie` request header. The fallback matters on SSR: when a page's
// inner $fetch forwards the outer request's cookie header (via
// useRequestFetch), getCookie occasionally misses it — parsing the raw
// header directly is the reliable path.
function readCookie(event: H3Event, name: string): string | null {
  const fromH3 = getCookie(event, name)
  if (fromH3) return fromH3
  const raw = getHeader(event, 'cookie') ?? ''
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match?.[1] ?? null
}

// After a refresh, rewrite THIS request's cookie header to the fresh
// pair. On SSR the page's inner /api fetches forward this header, so the
// rewrite lets them carry the new token instead of each re-refreshing the
// already-rotated one (a concurrent-refresh race). Request-scoped — only
// mutates the current event.
function forwardRefreshedCookies(event: H3Event, accessToken: string, refreshToken: string) {
  const req = event.node?.req
  if (!req) return
  const others = (getHeader(event, 'cookie') ?? '')
    .split(/;\s*/)
    .filter(Boolean)
    .filter(pair => !pair.startsWith('mm_access=') && !pair.startsWith('mm_refresh='))
  req.headers.cookie = [...others, `mm_access=${accessToken}`, `mm_refresh=${refreshToken}`].join('; ')
}

/** Read either the access token cookie or a Bearer header. */
function readAccessToken(event: H3Event): string {
  const header = getHeader(event, 'authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return readCookie(event, 'mm_access') ?? ''
}

/**
 * Attempt to authenticate the current request. Sets event.context.user
 * (+ accessToken) on success and returns the user, or null when no
 * valid credentials are present. Idempotent — safe to call repeatedly;
 * a prior middleware run short-circuits via the cached context.
 *
 * When the access token is missing/expired but a refresh token is
 * present, transparently refresh against the auth service and rewrite
 * the cookies. Keeping refresh HERE (rather than in the middleware
 * alone) means every gate restores a session — including /api/auth/me,
 * which the middleware skips and which the client calls on app open to
 * rehydrate after the access token has expired.
 */
export async function authenticate(event: H3Event): Promise<AuthUser | null> {
  if (event.context.user) return event.context.user

  const token = readAccessToken(event)
  const user = await verifyAccessToken(token)
  if (user) {
    event.context.user = user
    event.context.accessToken = token
    return user
  }

  // Access token absent or expired — fall back to the refresh token.
  const refreshToken = readCookie(event, 'mm_refresh')
  if (!refreshToken) return null

  try {
    const config = useRuntimeConfig()
    const result = await $fetch<{ access_token: string, refresh_token: string }>(
      `${config.authServiceUrl}/refresh`,
      { method: 'POST', body: { refresh_token: refreshToken } }
    )
    setAuthCookies(event, result.access_token, result.refresh_token)
    // Rewrite this request's cookie header so SSR inner fetches forward
    // the fresh pair rather than the stale (rotated-away) one.
    forwardRefreshedCookies(event, result.access_token, result.refresh_token)
    const refreshed = await verifyAccessToken(result.access_token)
    if (!refreshed) return null
    event.context.user = refreshed
    event.context.accessToken = result.access_token
    return refreshed
  }
  catch {
    // Refresh failed (rotated-away / revoked / auth-service blip). Stay
    // anonymous and let requireAuthUser throw the actual 401 at the gate.
    return null
  }
}

/** Same shape, but throws Unauthorized when there is no valid session. */
export async function requireAuthUser(event: H3Event): Promise<AuthUser> {
  const user = await authenticate(event)
  if (!user) throw new Unauthorized()
  return user
}

/**
 * The viewer's user id for scoping, or null for anonymous. Bridges the
 * HTTP transport (event.context.user) to the viewer-id the resource
 * data-access functions expect — same shape as the notes project.
 */
export function viewerId(event: H3Event): string | null {
  return event.context.user?.id ?? null
}

/** Synchronous read; null when the middleware hasn't authenticated yet. */
export function getAuthUser(event: H3Event): AuthUser | null {
  return event.context.user ?? null
}

export function setAuthCookies(event: H3Event, accessToken: string, refreshToken: string) {
  const secure = isSecure()
  setCookie(event, 'mm_access', accessToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/'
  })
  setCookie(event, 'mm_refresh', refreshToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 7
  })
}

export function clearAuthCookies(event: H3Event) {
  setCookie(event, 'mm_access', '', { path: '/', maxAge: 0 })
  setCookie(event, 'mm_refresh', '', { path: '/', maxAge: 0 })
}
