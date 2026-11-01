import { materializeDue, scheduleToday } from '../utils/recurring'

// Writes recurring transactions as they come due: once shortly after the
// server starts — which also catches up whatever fell due while it was
// down — and then every quarter of an hour, so an occurrence due today is
// in the ledger within minutes of midnight. Writing is idempotent (see
// server/utils/recurring.ts), so overlapping runs, or several replicas, do
// no harm.
const log = useLog('recurring')
const EVERY_MS = 15 * 60 * 1000

export default defineNitroPlugin((nitroApp) => {
  // `nuxt build` boots a throwaway Nitro to prerender; it must not write.
  if (import.meta.prerender) return

  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      const written = await materializeDue(scheduleToday())
      if (written) log.info('recurring transactions written', { written })
    }
    catch (error) {
      log.error('recurring run failed', { error })
    }
    finally {
      running = false
    }
  }

  const first = setTimeout(() => void run(), 5_000)
  const timer = setInterval(() => void run(), EVERY_MS)
  nitroApp.hooks.hook('close', () => {
    clearTimeout(first)
    clearInterval(timer)
  })
})
