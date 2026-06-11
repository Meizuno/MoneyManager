import { envSchema } from '../utils/env'

// Fail-fast env validation (= Pydantic Settings). Runs once at server
// startup; if required config is missing/invalid the process exits
// immediately rather than surfacing a 500 on the first request that
// happens to need it.
export default defineNitroPlugin(() => {
  // Skip during build-time prerendering: `nuxt build` boots a throwaway
  // Nitro instance to prerender routes, which legitimately has no
  // production env. Fail-fast validation is a real-server-startup
  // concern, so don't abort the build here.
  if (import.meta.prerender) return

  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('[env] Invalid environment configuration — refusing to start:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    process.exit(1)
  }
})
