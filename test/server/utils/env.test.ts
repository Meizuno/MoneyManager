import { describe, it, expect } from 'vitest'
import { envSchema } from '../../../server/utils/env'

const valid = {
  NUXT_DATABASE_URL: 'postgresql://user:pass@localhost:5432/money',
  NUXT_AUTH_SERVICE_URL: 'https://auth.example.com'
}

describe('envSchema', () => {
  it('accepts a valid environment and ignores unrelated keys', () => {
    const result = envSchema.safeParse({ ...valid, PATH: '/usr/bin', HOME: '/root' })
    expect(result.success).toBe(true)
  })

  it('rejects a missing database URL', () => {
    const result = envSchema.safeParse({ NUXT_AUTH_SERVICE_URL: valid.NUXT_AUTH_SERVICE_URL })
    expect(result.success).toBe(false)
  })

  it('rejects a non-URL auth service value', () => {
    const result = envSchema.safeParse({ ...valid, NUXT_AUTH_SERVICE_URL: 'not-a-url' })
    expect(result.success).toBe(false)
  })
})
