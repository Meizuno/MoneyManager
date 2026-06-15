import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import type { PrismaClient } from '@prisma/client'
import {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory
} from '../../../server/services/expense-categories'
import { authenticate } from '../../../server/utils/auth'
import { resolvePatPrincipal } from '../../../server/utils/pats'
import { Forbidden } from '../../../server/utils/errors'

// Exercise the expense-categories service through the REAL authorize /
// resolvePrincipal — only session/PAT resolution and Prisma are mocked —
// so the scope rules behind the new /api/expense-categories/* routes are
// verified: list → read, mutations → full-access only (mirrors income).
vi.mock('../../../server/utils/auth', () => ({ authenticate: vi.fn() }))
vi.mock('../../../server/utils/pats', () => ({ PAT_PREFIX: 'mm_pat_', resolvePatPrincipal: vi.fn() }))
const { dbRef } = vi.hoisted(() => ({ dbRef: { current: null as unknown } }))
vi.mock('../../../server/utils/db', () => ({
  getPrisma: () => dbRef.current as unknown as PrismaClient
}))

const mockAuthenticate = vi.mocked(authenticate)
const mockResolvePat = vi.mocked(resolvePatPrincipal)

function ev(headers: Record<string, string> = {}): H3Event {
  return { node: { req: { headers } }, context: {} } as unknown as H3Event
}
const readPat = () => ev({ authorization: 'Bearer mm_pat_read' })
const addPat = () => ev({ authorization: 'Bearer mm_pat_add' })
const session = () => ev() // no bearer → session path (authenticate)

function makeDb() {
  const row = { id: 1, label: 'Taxes', percent: 25, color: 'amber', position: 0, created_at: new Date(0) }
  return {
    expenseCategory: {
      findMany: vi.fn(async () => [row]),
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, id: 2, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => ({ ...row, id: 2 })),
      deleteMany: vi.fn(async () => ({ count: 1 }))
    },
    expense: { count: vi.fn(async () => 0) }
  }
}

let db: ReturnType<typeof makeDb>
beforeEach(() => {
  db = makeDb()
  dbRef.current = db
  mockAuthenticate.mockReset()
  mockResolvePat.mockReset()
})

describe('expense-categories service — read scope', () => {
  it('a read PAT can list, scoped to its user, in the income wrapper shape', async () => {
    mockResolvePat.mockResolvedValue({ userId: 'u1', scopes: ['read'] })
    const categories = await listExpenseCategories(readPat())
    expect(categories).toEqual([
      { id: 1, label: 'Taxes', percent: 25, color: 'amber', position: 0, created_at: new Date(0).toISOString() }
    ])
    expect(db.expenseCategory.findMany.mock.calls[0][0].where).toEqual({ user_id: 'u1' })
  })

  it('an add-only PAT cannot list (list needs read)', async () => {
    mockResolvePat.mockResolvedValue({ userId: 'u1', scopes: ['add'] })
    await expect(listExpenseCategories(addPat())).rejects.toBeInstanceOf(Forbidden)
  })
})

describe('expense-categories service — mutations are full-access only', () => {
  it('rejects a read/add PAT on create, update, and delete', async () => {
    mockResolvePat.mockResolvedValue({ userId: 'u1', scopes: ['read', 'add'] })
    await expect(createExpenseCategory(readPat(), { label: 'X', percent: 10 })).rejects.toBeInstanceOf(Forbidden)
    await expect(updateExpenseCategory(readPat(), 1, { label: 'Y' })).rejects.toBeInstanceOf(Forbidden)
    await expect(deleteExpenseCategory(readPat(), 1)).rejects.toBeInstanceOf(Forbidden)
    expect(db.expenseCategory.create).not.toHaveBeenCalled()
    expect(db.expenseCategory.deleteMany).not.toHaveBeenCalled()
  })

  it('a session (full access) can list and mutate', async () => {
    mockAuthenticate.mockResolvedValue({ id: 'u1' })
    await expect(listExpenseCategories(session())).resolves.toHaveLength(1)
    await expect(createExpenseCategory(session(), { label: 'X', percent: 10 })).resolves.toMatchObject({ label: 'X' })
    await expect(updateExpenseCategory(session(), 1, { label: 'Y' })).resolves.toBeTruthy()
    await expect(deleteExpenseCategory(session(), 1)).resolves.toEqual({ deleted: 1 })
  })
})
