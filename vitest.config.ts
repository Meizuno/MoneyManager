import { fileURLToPath } from 'node:url'
import { defineVitestConfig } from '@nuxt/test-utils/config'

// Default to a plain node environment — service/util/schema tests run
// without a Nuxt runtime. Tests that need the Nuxt environment (e.g.
// composables/components) opt in per-file with:
//   // @vitest-environment nuxt
export default defineVitestConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts']
  },
  // server/utils/db imports Prisma's pg adapter, and node-postgres won't load
  // under the browser resolve conditions this config applies. No test talks
  // to Postgres (they mock getPrisma), so a stub stands in.
  resolve: {
    alias: { '@prisma/adapter-pg': fileURLToPath(new URL('./test/stubs/adapter-pg.ts', import.meta.url)) }
  }
})
