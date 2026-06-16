import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withValidationCache, __clearValidationCache } from '../../../server/utils/auth'

// withValidationCache is the dedupe core behind verifyAccessToken: a
// short-TTL cache keyed by the token so a single request's SSR fan-out
// (several /api calls all forwarding the same mm_access cookie) validates
// only once. The validator is injected here so the cache is exercised
// without the Nuxt-only globals ($fetch / useRuntimeConfig) the real
// fetch path uses.

beforeEach(() => {
  __clearValidationCache()
})

describe('withValidationCache', () => {
  it('validates a token only once across repeated calls (the SSR fan-out)', async () => {
    const validate = vi.fn(async () => ({ id: 'u1' }))
    const a = await withValidationCache('tok-1', validate)
    const b = await withValidationCache('tok-1', validate)
    const c = await withValidationCache('tok-1', validate)
    expect(a).toEqual({ id: 'u1' })
    expect(b).toEqual({ id: 'u1' })
    expect(c).toEqual({ id: 'u1' })
    expect(validate).toHaveBeenCalledTimes(1)
  })

  it('caches per distinct token', async () => {
    const validate = vi.fn(async (): Promise<{ id: string }> => ({ id: 'u1' }))
    await withValidationCache('tok-1', validate)
    await withValidationCache('tok-2', validate)
    await withValidationCache('tok-1', validate)
    expect(validate).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failed validation — it is retried', async () => {
    const validate = vi.fn(async () => null)
    expect(await withValidationCache('tok-1', validate)).toBeNull()
    expect(await withValidationCache('tok-1', validate)).toBeNull()
    expect(validate).toHaveBeenCalledTimes(2)
  })

  it('returns null for an empty token without invoking the validator', async () => {
    const validate = vi.fn(async () => ({ id: 'u1' }))
    expect(await withValidationCache('', validate)).toBeNull()
    expect(validate).not.toHaveBeenCalled()
  })
})
