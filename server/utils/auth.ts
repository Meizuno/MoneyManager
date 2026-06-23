import { getCookie, getHeader, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { Unauthorized } from './errors'

export type AuthUser = { id: string }

// The auth service issues these cookies on COOKIE_DOMAIN (e.g. .meizuno.com),
// so one sign-in is valid across every *.meizuno.com app. We read the SAME
// names it sets, and only re-set them (with the same attributes) when we
// rotate the pair on refresh. access_token is readable (SPAs may Bearer it),
// refresh_token is httpOnly — mirroring the auth service exactly.
const ACCESS_COOKIE = 'access_token'
const REFRESH_COOKIE = 'refresh_token'
const ACCESS_MAX_AGE = 60 * 15
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7

// Secure cookies everywhere except the dev server (http localhost).
// import.meta.dev is the Nuxt-native signal — avoids reading process.env
// outside the env plugin (per architecture rule).
const isSecure = () => !import.meta.dev

// Parent domain the cookies are scoped to (NUXT_COOKIE_DOMAIN, e.g.
// `.meizuno.com`). Empty in dev → host-only cookies on localhost.
function cookieDomain(): string | undefined {
  return (useRuntimeConfig().cookieDomain as string) || undefined
}

/** Validate a token string against the auth service. */
export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  if (!token) return null
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
    .filter(pair => !pair.startsWith(`${ACCESS_COOKIE}=`) && !pair.startsWith(`${REFRESH_COOKIE}=`))
  req.headers.cookie = [...others, `${ACCESS_COOKIE}=${accessToken}`, `${REFRESH_COOKIE}=${refreshToken}`].join('; ')
}

/** Read either the access token cookie or a Bearer header. */
function readAccessToken(event: H3Event): string {
  const header = getHeader(event, 'authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return readCookie(event, ACCESS_COOKIE) ?? ''
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
  const refreshToken = readCookie(event, REFRESH_COOKIE)
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

// Re-set the shared cookies after a rotation. Attributes mirror the auth
// service so whichever side last writes them, the cookie stays identical.
export function setAuthCookies(event: H3Event, accessToken: string, refreshToken: string) {
  const secure = isSecure()
  const domain = cookieDomain()
  setCookie(event, ACCESS_COOKIE, accessToken, {
    httpOnly: false, sameSite: 'lax', secure, path: '/', domain, maxAge: ACCESS_MAX_AGE
  })
  setCookie(event, REFRESH_COOKIE, refreshToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', domain, maxAge: REFRESH_MAX_AGE
  })
}

export function clearAuthCookies(event: H3Event) {
  const domain = cookieDomain()
  setCookie(event, ACCESS_COOKIE, '', { path: '/', domain, maxAge: 0 })
  setCookie(event, REFRESH_COOKIE, '', { path: '/', domain, maxAge: 0 })
}
