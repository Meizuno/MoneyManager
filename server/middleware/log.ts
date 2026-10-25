import { randomUUID } from 'node:crypto'

// Request logging. Stamps each request with a requestId (also returned
// as x-request-id for client/log correlation), puts it on
// event.context so downstream code can read it without threading it
// through signatures, and emits one structured line per completed
// request — key/value fields, not string concatenation (server/utils/log.ts).
const log = useLog('http')
// Polled every few seconds by Docker and Traefik, it would drown out the
// rest (as in server/utils/metrics.ts, and Forma's /health).
const UNLOGGED = new Set(['/api/health'])

export default defineEventHandler((event) => {
  const requestId = randomUUID()
  event.context.requestId = requestId
  setResponseHeader(event, 'x-request-id', requestId)

  const start = Date.now()
  event.node.res.on('finish', () => {
    if (UNLOGGED.has(event.path)) return
    const status = event.node.res.statusCode
    // A 5xx is an error whether or not anything threw on the way.
    log[status >= 500 ? 'error' : 'info']('request', {
      requestId,
      method: event.method,
      path: event.path,
      status,
      durationMs: Date.now() - start
    })
  })
})
