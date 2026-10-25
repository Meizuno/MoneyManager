// Continuous CPU and memory profiles, pushed to Pyroscope at
// NUXT_PYROSCOPE_SERVER_ADDRESS (e.g. http://pyroscope:4040) and shown in
// Grafana as service `money-manager`. Unset = off, as in dev and tests.
//
// CPU comes from wall-clock samples that carry their CPU time
// (collectCpuTime), so the CPU view holds only time spent computing — a
// request awaiting Postgres is on no stack meanwhile. Memory is V8's
// sampling heap profiler: what is still held, not what was allocated and
// freed since.
const log = useLog('profiling')

export default defineNitroPlugin(async (nitroApp) => {
  if (import.meta.prerender) return

  const serverAddress = useRuntimeConfig().pyroscopeServerAddress
  if (!serverAddress) return

  // Loaded only when on: the SDK carries a native module (@datadog/pprof),
  // which dev and tests then never load. If it can't be, the app runs
  // without profiles rather than not at all.
  try {
    const { default: Pyroscope } = await import('@pyroscope/nodejs')
    Pyroscope.init({ appName: 'money-manager', serverAddress, wall: { collectCpuTime: true } })
    Pyroscope.start()
    // Uploads what was sampled since the last upload (one a minute).
    nitroApp.hooks.hook('close', () => Pyroscope.stop())
  }
  catch (error) {
    log.error('profiling is off', { error })
  }
})
