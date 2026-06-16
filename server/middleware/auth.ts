// Pre-route auth pass for PAGE (SSR) requests only.
//
// API auth is decided per-operation by authorize() in the services, the
// MCP endpoint, and the prompt handlers: each resolves the principal
// (session cookie, Bearer JWT, or PAT) and checks the operation's scope.
// So the middleware no longer touches /api/* at all.
//
// For a page request it runs authenticate(), which validates the session
// and — when the access token is stale — refreshes ONCE and rewrites the
// request cookie header in place, so the page's inner /api fetches
// (useRequestFetch forwards this request's cookies) carry the fresh
// token and the first render is authenticated.
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path.startsWith('/api/')) return
  if (path.startsWith('/auth-proxy/')) return // reverse-proxied to the auth service
  if (path.includes('.')) return // static asset
  await authenticate(event)
})
