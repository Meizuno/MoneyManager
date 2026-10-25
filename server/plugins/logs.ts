// In production, what Nitro, h3 and the libraries print through console —
// an unhandled error with its stack, a cache failure — goes out as log
// entries too, one line each with its level (server/utils/log.ts). Not while
// `nuxt build` prerenders, whose output is read in the build log.
export default defineNitroPlugin(() => {
  if (import.meta.dev || import.meta.prerender) return
  routeConsoleToLog()
})
