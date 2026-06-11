import { randomUUID } from 'node:crypto'
import { consola } from 'consola'

// Request logging. Stamps each request with a requestId (also returned
// as x-request-id for client/log correlation), puts it on
// event.context so downstream code can read it without threading it
// through signatures, and emits one structured line per completed
// request — key/value fields, not string concatenation.
const log = consola.withTag('http')

export default defineEventHandler((event) => {
  const requestId = randomUUID()
  event.context.requestId = requestId
  setResponseHeader(event, 'x-request-id', requestId)

  const start = Date.now()
  event.node.res.on('finish', () => {
    log.info('request', {
      requestId,
      method: event.method,
      path: event.path,
      status: event.node.res.statusCode,
      durationMs: Date.now() - start
    })
  })
})
