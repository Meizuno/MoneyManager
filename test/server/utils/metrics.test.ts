import { EventEmitter } from 'node:events'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, createError, createRouter, toNodeListener, type H3Event } from 'h3'
import { RequestMetrics, routeOf } from '../../../server/utils/metrics'

// Request count per "METHOD route status", read back from the histogram.
async function counts(metrics: RequestMetrics): Promise<Record<string, number>> {
  const histogram = metrics.registry.getSingleMetric('http_request_duration_seconds')
  const { values } = await histogram!.get()
  const out: Record<string, number> = {}
  for (const { metricName, labels, value } of values) {
    if (metricName === 'http_request_duration_seconds_count') {
      out[`${labels.method} ${labels.route} ${labels.status}`] = value
    }
  }
  return out
}

// The observation lands on the response's `close`, a moment after the
// client has its answer.
async function settled(metrics: RequestMetrics, key: string) {
  await expect.poll(async () => (await counts(metrics))[key]).toBe(1)
}

function eventLike(path: string | undefined): H3Event {
  return { context: { matchedRoute: path === undefined ? undefined : { path } } } as unknown as H3Event
}

describe('routeOf', () => {
  it('names a request by the template it matched, never by its path', () => {
    expect(routeOf(eventLike('/api/transactions/:id'))).toBe('/api/transactions/:id')
  })

  it('calls the page renderer\'s catch-all a page', () => {
    expect(routeOf(eventLike('/**'))).toBe('page')
  })

  it('calls a request no route matched static — the static handler answered it', () => {
    expect(routeOf(eventLike(undefined))).toBe('static')
  })
})

describe('RequestMetrics over HTTP', () => {
  let metrics: RequestMetrics
  let server: Server
  let base: string
  let release: () => void

  beforeEach(async () => {
    metrics = new RequestMetrics()
    const app = createApp({ onRequest: event => metrics.track(event) })
    // Like Nitro's static handler: a middleware that answers before the router.
    app.use('/_nuxt', () => 'console.log(1)')
    const router = createRouter({ preemptive: true })
    router.get('/api/transactions/:id', event => ({ id: event.context.params!.id }))
    router.get('/api/health', () => ({ status: 'ok' }))
    router.get('/api/boom', () => {
      throw createError({ statusCode: 500 })
    })
    router.get('/api/hang', () => new Promise<void>((resolve) => {
      release = resolve
    }))
    router.get('/**', () => '<html></html>')
    app.use(router)
    server = createServer(toNodeListener(app))
    await new Promise<void>(resolve => server.listen(0, resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(() => {
    release?.()
    server.closeAllConnections()
    server.close()
  })

  it('times a request under its route template and status class', async () => {
    await fetch(`${base}/api/transactions/41`)
    await fetch(`${base}/api/transactions/42`)
    await expect.poll(async () => (await counts(metrics))['GET /api/transactions/:id 2xx']).toBe(2)
  })

  it('tells pages, static files and server errors apart', async () => {
    await fetch(`${base}/overview`)
    await fetch(`${base}/_nuxt/entry.js`)
    await fetch(`${base}/api/boom`)
    await settled(metrics, 'GET page 2xx')
    await settled(metrics, 'GET static 2xx')
    await settled(metrics, 'GET /api/boom 5xx')
  })

  it('leaves the health check out', async () => {
    await fetch(`${base}/api/health`)
    await fetch(`${base}/api/transactions/1`)
    await settled(metrics, 'GET /api/transactions/:id 2xx')
    expect(Object.keys(await counts(metrics))).toEqual(['GET /api/transactions/:id 2xx'])
  })

  it('counts a client that left before any answer as status none', async () => {
    const leaving = new AbortController()
    const request = fetch(`${base}/api/hang`, { signal: leaving.signal }).catch(() => undefined)
    await expect.poll(() => release).toBeDefined()
    leaving.abort()
    await request
    await settled(metrics, 'GET /api/hang none')
  })

  it('serves everything on its own port, process CPU and memory included', async () => {
    await fetch(`${base}/api/transactions/1`)
    await settled(metrics, 'GET /api/transactions/:id 2xx')
    const exporter = await metrics.serve(0)
    try {
      const response = await fetch(`http://127.0.0.1:${(exporter.address() as AddressInfo).port}/metrics`)
      expect(response.headers.get('content-type')).toContain('text/plain')
      const body = await response.text()
      for (const name of ['http_request_duration_seconds_bucket', 'process_cpu_seconds_total', 'process_resident_memory_bytes', 'nodejs_version_info']) {
        expect(body).toContain(name)
      }
    }
    finally {
      exporter.close()
    }
  })

  it('refuses a port that is taken', async () => {
    const port = (server.address() as AddressInfo).port
    await expect(metrics.serve(port)).rejects.toMatchObject({ code: 'EADDRINUSE' })
  })
})

describe('RequestMetrics.track', () => {
  it('ignores server-side rendering\'s own calls, which arrive on a mock socket', async () => {
    const metrics = new RequestMetrics()
    const res = Object.assign(new EventEmitter(), { headersSent: true, statusCode: 200 })
    const event = {
      method: 'GET',
      node: { req: { socket: new EventEmitter() }, res },
      context: { matchedRoute: { path: '/api/overview' } }
    } as unknown as H3Event
    metrics.track(event)
    res.emit('close')
    expect(await counts(metrics)).toEqual({})
  })
})
