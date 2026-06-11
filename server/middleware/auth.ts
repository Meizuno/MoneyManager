import { getCookie } from 'h3'

// Pre-route auth pass. For each /api/* request (except the explicitly
// excluded auth/mcp/prompt/health surfaces) we populate
// event.context.user when a valid session is present; downstream
// services call requireAuthUser() to gate, or viewerId() to scope reads.
//
// On a stale access token we attempt one refresh against the auth
// service and rewrite the cookies on success. A failed refresh leaves
// the request anonymous — downstream requireAuthUser throws the actual
// 401. (Clearing cookies on refresh failure was too aggressive: a
// transient auth-service blip would log the user out of every tab.)
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (
    !path.startsWith('/api/')
    || path.startsWith('/api/auth/')
    || path.startsWith('/api/mcp')
    || path.startsWith('/api/prompts/')
    || path === '/api/health'
  ) return

  const ok = await authenticate(event)
  if (ok) return

  const refreshToken = getCookie(event, 'mm_refresh')
  if (!refreshToken) return

  try {
    const config = useRuntimeConfig()
    const result = await $fetch<{ access_token: string, refresh_token: string }>(
      `${config.authServiceUrl}/refresh`,
      { method: 'POST', body: { refresh_token: refreshToken } }
    )
    setAuthCookies(event, result.access_token, result.refresh_token)
    const refreshed = await verifyAccessToken(result.access_token)
    if (refreshed) {
      event.context.user = refreshed
      event.context.accessToken = result.access_token
    }
  }
  catch {
    // Silent — see comment above. Stay anonymous; let requireAuthUser
    // throw the 401 at the actual gate.
  }
})
