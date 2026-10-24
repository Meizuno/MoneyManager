// Stands in for @prisma/adapter-pg in tests (see vitest.config.ts). No test
// talks to Postgres — they mock getPrisma — but server/utils/db imports the
// adapter, and node-postgres won't load under the Nuxt test config's
// browser resolve conditions.
export class PrismaPg {
  readonly adapterName = 'test-stub'
}
