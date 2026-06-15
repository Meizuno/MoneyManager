import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  PAT_PREFIX,
  createPatScoped,
  generateRawToken,
  hashToken,
  listPatsScoped,
  resolvePatPrincipal,
  revokePatScoped
} from '../../../server/utils/pats'
import { PatNotFound } from '../../../server/utils/errors'

// Mock the Prisma accessor so the PAT data-access runs against an
// in-memory fake (same pattern as the transactions tests).
const { dbRef } = vi.hoisted(() => ({ dbRef: { current: null as unknown } }))
vi.mock('../../../server/utils/db', () => ({
  getPrisma: () => dbRef.current as unknown as PrismaClient
}))

function makeDb() {
  return {
    personalAccessToken: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'pat_1',
        created_at: new Date(0),
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        ...data
      })),
      findMany: vi.fn(async () => [] as unknown[]),
      findUnique: vi.fn(async () => null as unknown),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 }))
    }
  }
}

let db: ReturnType<typeof makeDb>
beforeEach(() => {
  db = makeDb()
  dbRef.current = db
})

describe('token format + hashing', () => {
  it('generates mm_pat_-prefixed base64url tokens that differ each call', () => {
    const a = generateRawToken()
    const b = generateRawToken()
    expect(a.startsWith(PAT_PREFIX)).toBe(true)
    expect(a).not.toBe(b)
    // base64url body: no +, /, or = padding.
    const body = a.slice(PAT_PREFIX.length)
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('hashes deterministically and never returns the raw value', () => {
    const raw = 'mm_pat_abc'
    expect(hashToken(raw)).toBe(hashToken(raw))
    expect(hashToken(raw)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashToken(raw)).not.toBe(raw)
  })
})

describe('createPatScoped', () => {
  it('stores only the hash and returns the raw token once', async () => {
    const { token, pat } = await createPatScoped('u1', 'CI', ['read', 'add'])
    expect(token.startsWith(PAT_PREFIX)).toBe(true)

    const data = db.personalAccessToken.create.mock.calls[0][0].data
    expect(data.token_hash).toBe(hashToken(token))
    expect(data.token_hash).not.toBe(token)
    expect(data.user_id).toBe('u1')
    expect(data.scopes).toEqual(['read', 'add'])

    // The summary never exposes the hash.
    expect(pat).not.toHaveProperty('token_hash')
    expect(pat.scopes).toEqual(['read', 'add'])
  })
})

describe('resolvePatPrincipal', () => {
  it('ignores values without the PAT prefix (and never hits the db)', async () => {
    expect(await resolvePatPrincipal('not-a-pat')).toBeNull()
    expect(db.personalAccessToken.findUnique).not.toHaveBeenCalled()
  })

  it('resolves a valid token to its scopes and bumps last_used_at', async () => {
    db.personalAccessToken.findUnique.mockResolvedValue({
      id: 'pat_1', user_id: 'u1', scopes: ['read'], revoked_at: null, expires_at: null
    })
    const principal = await resolvePatPrincipal('mm_pat_valid')
    expect(principal).toEqual({ userId: 'u1', scopes: ['read'] })
    expect(db.personalAccessToken.update).toHaveBeenCalledOnce()
    expect(db.personalAccessToken.update.mock.calls[0][0].data).toHaveProperty('last_used_at')
  })

  it('rejects unknown, revoked, and expired tokens', async () => {
    db.personalAccessToken.findUnique.mockResolvedValue(null)
    expect(await resolvePatPrincipal('mm_pat_x')).toBeNull()

    db.personalAccessToken.findUnique.mockResolvedValue({
      id: 'p', user_id: 'u1', scopes: ['read'], revoked_at: new Date(0), expires_at: null
    })
    expect(await resolvePatPrincipal('mm_pat_x')).toBeNull()

    db.personalAccessToken.findUnique.mockResolvedValue({
      id: 'p', user_id: 'u1', scopes: ['read'], revoked_at: null, expires_at: new Date(1)
    })
    expect(await resolvePatPrincipal('mm_pat_x')).toBeNull()

    // None of the rejections should bump last_used_at.
    expect(db.personalAccessToken.update).not.toHaveBeenCalled()
  })

  it('drops unknown scope strings from a stored token', async () => {
    db.personalAccessToken.findUnique.mockResolvedValue({
      id: 'p', user_id: 'u1', scopes: ['read', 'delete'], revoked_at: null, expires_at: null
    })
    expect(await resolvePatPrincipal('mm_pat_x')).toEqual({ userId: 'u1', scopes: ['read'] })
  })
})

describe('list + revoke (scoped)', () => {
  it('lists summaries without the hash', async () => {
    db.personalAccessToken.findMany.mockResolvedValue([{
      id: 'p', name: 'CI', scopes: ['read'], created_at: new Date(0), last_used_at: null, expires_at: null
    }])
    const pats = await listPatsScoped('u1')
    expect(pats[0]).not.toHaveProperty('token_hash')
    expect(pats[0]!.scopes).toEqual(['read'])
  })

  it('revokes when a row matches and throws PatNotFound otherwise', async () => {
    db.personalAccessToken.updateMany.mockResolvedValue({ count: 1 })
    await expect(revokePatScoped('u1', 'p')).resolves.toEqual({ revoked: 'p' })

    db.personalAccessToken.updateMany.mockResolvedValue({ count: 0 })
    await expect(revokePatScoped('u1', 'missing')).rejects.toBeInstanceOf(PatNotFound)
  })
})
