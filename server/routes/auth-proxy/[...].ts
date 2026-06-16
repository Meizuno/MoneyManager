import { Buffer } from 'node:buffer'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { getRequestHeaders, getRequestURL, getRouterParam, readRawBody } from 'h3'

// Reverse proxy for the browser-facing OAuth flow. The browser hits
// /auth-proxy/** on the app (the single public origin); we forward to
// NUXT_AUTH_SERVICE_URL/** so the auth server can live on the internal
// Docker network with no public address of its own.
//
// Why a hand-rolled proxy instead of h3's proxyRequest: the OAuth dance is
// a chain of 302s the BROWSER must follow (to Google and back). Native
// fetch can't forward a redirect — `redirect: 'manual'` yields an opaque
// response with no Location — so we use Node's http/https client, which
// doesn't follow redirects and exposes status + headers verbatim.
//
// Prerequisite: the auth server's external base URL must be configured to
// <app>/auth-proxy so the Google redirect_uri it builds points back here
// (and that callback registered in the Google OAuth client).

// Hop-by-hop headers must not be forwarded by a proxy (RFC 7230 §6.1).
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'
])

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const wildcard = getRouterParam(event, '_') ?? ''
  const search = getRequestURL(event).search
  const base = config.authServiceUrl.replace(/\/+$/, '')
  const target = new URL(`${base}/${wildcard}${search}`)
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest

  // OAuth endpoints are GET, but stay correct for any method routed here.
  const method = event.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? Buffer.from((await readRawBody(event, false)) ?? '') : undefined

  const reqHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) continue
    reqHeaders[key] = value
  }
  // Upstream expects its own Host; forwarding the app's would break vhosts.
  reqHeaders.host = target.host

  await new Promise<void>((resolve, reject) => {
    const upstream = transport(target, { method, headers: reqHeaders }, (res) => {
      const resHeaders: Record<string, string | string[]> = {}
      for (const [key, value] of Object.entries(res.headers)) {
        if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) continue
        resHeaders[key] = value
      }
      // Forward status + headers (incl. Location and Set-Cookie) and stream
      // the body. 3xx responses are forwarded, not followed, so the Google
      // hop happens in the browser as OAuth requires.
      event.node.res.writeHead(res.statusCode ?? 502, resHeaders)
      res.pipe(event.node.res)
      res.on('end', resolve)
      res.on('error', reject)
    })
    upstream.on('error', reject)
    upstream.end(body)
  })
})
