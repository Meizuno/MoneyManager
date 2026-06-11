import { defineVitestConfig } from '@nuxt/test-utils/config'

// Default to a plain node environment — service/util/schema tests run
// without a Nuxt runtime. Tests that need the Nuxt environment (e.g.
// composables/components) opt in per-file with:
//   // @vitest-environment nuxt
export default defineVitestConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts']
  }
})
