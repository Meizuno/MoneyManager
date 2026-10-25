// Prometheus metrics on NUXT_METRICS_PORT (see server/utils/metrics.ts).
// Unset = off, as in dev and tests: nothing is timed and no port is opened.
const log = useLog('metrics')

export default defineNitroPlugin((nitroApp) => {
  // Same reason as validate-env: `nuxt build` boots a throwaway Nitro to
  // prerender, and it must not open a port.
  if (import.meta.prerender) return

  const port = Number(useRuntimeConfig().metricsPort)
  if (!Number.isInteger(port) || port <= 0) return

  const metrics = new RequestMetrics()
  nitroApp.hooks.hook('request', event => metrics.track(event))

  // A port that can't be had costs the metrics, not the app: the error is
  // logged, and the dashboards show the target as down.
  const listening = metrics.serve(port).catch((error: unknown) => {
    log.error('cannot serve metrics', { port, error })
    return undefined
  })
  nitroApp.hooks.hook('close', async () => {
    (await listening)?.close()
  })
})
