import { createServer, type Server } from 'node:http'
import { Socket } from 'node:net'
import { Histogram, Registry, collectDefaultMetrics } from '@prometheus-io/client'
import type { H3Event } from 'h3'

// Prometheus metrics: request durations by route, plus the process's own
// CPU and memory (and Node's heap, GC and event-loop lag), scraped by
// victoria-metrics for Grafana's "Meizuno — Apps" dashboard.
//
// Served on a port of their own (NUXT_METRICS_PORT, wired up in
// server/plugins/metrics.ts), never on the app's: Traefik routes the public
// host to :3000, so /metrics there would be public. One registry per
// instance rather than the library's global one, so tests can build several.

// Seconds. Past the library's 10 s, because a request is timed to its last
// byte and an MCP stream can stay open a while.
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60]
// Polled every few seconds by Docker and Traefik; it would drown out the rest.
const UNMEASURED = new Set(['/api/health'])

// The matched route's template (`/api/transactions/:id`), never the path, so
// the number of series stays bounded by the number of routes. Nuxt renders
// pages from Nitro's catch-all `/**`, so a page is `page` — a 404 page too.
// No match at all means a middleware answered before the router, which here
// is only ever Nitro's static handler serving the built client's files.
export function routeOf(event: H3Event): string {
  const matched = event.context.matchedRoute?.path
  if (matched === undefined) return 'static'
  return matched === '/**' ? 'page' : matched
}

// 0 = no response was ever started: an unhandled error on its way out, or a
// client that left first.
function statusClass(status: number): string {
  return status ? `${Math.floor(status / 100)}xx` : 'none'
}

export class RequestMetrics {
  readonly registry = new Registry()
  private readonly durations: Histogram<'method' | 'route' | 'status'>

  constructor() {
    collectDefaultMetrics({ register: this.registry })
    this.durations = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Time to serve a request, to its last byte, by route template.',
      labelNames: ['method', 'route', 'status'],
      buckets: BUCKETS,
      registers: [this.registry]
    })
  }

  observe(method: string, route: string, status: number, seconds: number) {
    if (UNMEASURED.has(route)) return
    this.durations.labels(method, route, statusClass(status)).observe(seconds)
  }

  // Times one request, from Nitro's `request` hook to the response's last
  // byte — or to the client leaving, whichever comes first.
  track(event: H3Event) {
    const { req, res } = event.node
    // Only what came over the network. Server-side rendering's own $fetch
    // calls to /api run through the same handlers on a mock socket, and
    // their time is already inside the page's.
    if (!(req.socket instanceof Socket)) return
    const started = performance.now()
    res.once('close', () => {
      const status = res.headersSent ? res.statusCode : 0
      this.observe(event.method, routeOf(event), status, (performance.now() - started) / 1000)
    })
  }

  // Starts the exporter on `port` (any path answers); resolves once it
  // listens, rejects if it can't.
  serve(port: number): Promise<Server> {
    const server = createServer((_req, res) => {
      this.registry.metrics().then(
        (body) => {
          res.writeHead(200, { 'content-type': this.registry.contentType }).end(body)
        },
        (error: unknown) => {
          res.writeHead(500).end(String(error))
        }
      )
    })
    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, () => resolve(server))
    })
  }
}
