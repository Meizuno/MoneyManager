import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import { resolvePrincipal, authorize } from '../../../server/utils/principal'
import { authenticate } from '../../../server/utils/auth'
import { resolvePatPrincipal } from '../../../server/utils/pats'
import { Forbidden, Unauthorized } from '../../../server/utils/errors'

// Mock the two collaborators resolvePrincipal composes: the existing
// session/JWT validator and the PAT resolver. The scope predicate and
// errors are real. (vitest hoists vi.mock above these imports.)
vi.mock('../../../server/utils/auth', () => ({ authenticate: vi.fn() }))
vi.mock('../../../server/utils/pats', () => ({
  PAT_PREFIX: 'mm_pat_',
  resolvePatPrincipal: vi.fn()
}))

const mockAuthenticate = vi.mocked(authenticate)
const mockResolvePat = vi.mocked(resolvePatPrincipal)

function ev(headers: Record<string, string> = {}): H3Event {
  return { node: { req: { headers } }, context: {} } as unknown as H3Event
}

beforeEach(() => {
  mockAuthenticate.mockReset()
  mockResolvePat.mockReset()
})

describe('resolvePrincipal', () => {
  it('resolves a valid PAT to its scopes without touching session auth', async () => {
    mockResolvePat.mockResolvedValue({ userId: 'u1', scopes: ['read'] })
    const principal = await resolvePrincipal(ev({ authorization: 'Bearer mm_pat_xyz' }))
    expect(principal).toEqual({ userId: 'u1', scopes: ['read'] })
    expect(mockAuthenticate).not.toHaveBeenCalled()
  })

  it('rejects an invalid PAT with 401', async () => {
    mockResolvePat.mockResolvedValue(null)
    await expect(resolvePrincipal(ev({ authorization: 'Bearer mm_pat_bad' })))
      .rejects.toBeInstanceOf(Unauthorized)
  })

  it('treats a valid session/JWT as full access', async () => {
    mockAuthenticate.mockResolvedValue({ id: 'u1' })
    const principal = await resolvePrincipal(ev({ authorization: 'Bearer some.jwt.token' }))
    expect(principal).toEqual({ userId: 'u1', scopes: 'all' })
    expect(mockResolvePat).not.toHaveBeenCalled()
  })

  it('rejects when no valid credential is present', async () => {
    mockAuthenticate.mockResolvedValue(null)
    await expect(resolvePrincipal(ev())).rejects.toBeInstanceOf(Unauthorized)
  })

  it('ignores the removed x-api-key + x-user-id headers (legacy path is gone)', async () => {
    mockAuthenticate.mockResolvedValue(null)
    await expect(
      resolvePrincipal(ev({ 'x-api-key': 'secret', 'x-user-id': 'attacker' }))
    ).rejects.toBeInstanceOf(Unauthorized)
  })

  it('caches the principal on the event', async () => {
    mockResolvePat.mockResolvedValue({ userId: 'u1', scopes: ['read'] })
    const event = ev({ authorization: 'Bearer mm_pat_xyz' })
    await resolvePrincipal(event)
    await resolvePrincipal(event)
    expect(mockResolvePat).toHaveBeenCalledOnce()
  })
})

describe('authorize', () => {
  it('passes when the principal holds the scope and denies otherwise', async () => {
    mockResolvePat.mockResolvedValue({ userId: 'u1', scopes: ['read'] })
    const event = ev({ authorization: 'Bearer mm_pat_read' })

    await expect(authorize(event, 'read')).resolves.toMatchObject({ userId: 'u1' })
    // out-of-scope (add) and full-access-only (no scope) → 403
    await expect(authorize(event, 'add')).rejects.toBeInstanceOf(Forbidden)
    await expect(authorize(event)).rejects.toBeInstanceOf(Forbidden)
  })

  it('bridges the user id onto event.context.user for scoped data-access', async () => {
    mockResolvePat.mockResolvedValue({ userId: 'u9', scopes: ['add'] })
    const event = ev({ authorization: 'Bearer mm_pat_add' })
    await authorize(event, 'add')
    expect((event.context as { user?: { id: string } }).user).toEqual({ id: 'u9' })
  })

  it('grants a full-access (session) principal everything', async () => {
    mockAuthenticate.mockResolvedValue({ id: 'u1' })
    const event = ev({ authorization: 'Bearer jwt' })
    await expect(authorize(event, 'read')).resolves.toBeTruthy()
    await expect(authorize(event, 'add')).resolves.toBeTruthy()
    await expect(authorize(event)).resolves.toBeTruthy()
  })
})
