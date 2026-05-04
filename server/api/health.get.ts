// Public health endpoint. No auth required (allow-listed in `auth.ts`).
// Used by the Docker HEALTHCHECK directive and any external monitor.
//
// Keep it cheap — no DB calls, no external service hops. The point is
// to answer "is the HTTP layer up?" with as little latency as possible.

export default defineEventHandler(() => {
  return { status: 'ok' }
})
