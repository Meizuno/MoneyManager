import { getCookie, getHeader, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { Unauthorized } from './errors'

export type AuthUser = { id: string }

// Secure cookies everywhere except the dev server (http localhost).
// import.meta.dev is the Nuxt-native signal — avoids reading process.env
// outside the env plugin (per architecture rule).
const isSecure = () => !import.meta.dev

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

/** Read either the access token cookie or a Bearer header. */
function readAccessToken(event: H3Event): string {
  const header = getHeader(event, 'authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return getCookie(event, 'mm_access') ?? ''
}

/**
 * Attempt to authenticate the current request. Sets event.context.user
 * (+ accessToken) on success and returns the user, or null when no
 * valid credentials are present. Idempotent — safe to call repeatedly;
 * a prior middleware run short-circuits via the cached context.
 */
export async function authenticate(event: H3Event): Promise<AuthUser | null> {
  if (event.context.user) return event.context.user
  const token = readAccessToken(event)
  const user = await verifyAccessToken(token)
  if (!user) return null
  event.context.user = user
  event.context.accessToken = token
  return user
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
