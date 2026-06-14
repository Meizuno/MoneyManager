// Pre-route auth pass. Runs authenticate() for API *and* page requests:
//   - API routes: populate event.context.user so services can
//     requireAuthUser() to gate or viewerId() to scope reads.
//   - Page (SSR) routes: authenticate the page request itself so a stale
//     access token is refreshed ONCE here and the cookie header rewritten
//     in place — the page's inner /api fetches (useRequestFetch forwards
//     this request's cookies) then carry the fresh token instead of each
//     racing to refresh the rotated one. This is what makes SSR-first
//     data fetching authenticated on the very first render.
//
// authenticate() owns the validate → refresh → rewrite-cookies logic.
// The excluded surfaces manage their own auth (e.g. /api/auth/me runs
// authenticate() via requireAuthUser; the OAuth handshake needs none).
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (
    path.startsWith('/api/auth/')
    || path.startsWith('/api/mcp')
    || path.startsWith('/api/prompts/')
    || path === '/api/health'
  ) return

  // Skip static assets (they carry a file extension); authenticate every
  // API route and every page navigation.
  const isApi = path.startsWith('/api/')
  if (!isApi && path.includes('.')) return

  await authenticate(event)
})
