import { z } from 'zod'

// Personal access token request shapes. The scope literals mirror
// server/utils/scopes.ts — kept inline here so the shared layer has no
// server import. Today a PAT may hold `read` and/or `add`; destructive /
// structural operations are full-access only and have no scope to grant.
export const patScopeSchema = z.enum(['read', 'add'])
export type PatScope = z.infer<typeof patScopeSchema>

// POST /api/pats. At least one scope is required (a scopeless token
// could do nothing). `expiresAt` is an optional ISO datetime.
export const createPatSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  scopes: z.array(patScopeSchema).min(1, 'At least one scope is required'),
  expiresAt: z.string().datetime().optional()
})
export type CreatePatInput = z.infer<typeof createPatSchema>

// Wire shape — what the management endpoints return. The raw token is
// returned ONLY in the create response (alongside this summary) and
// never again; the hash is never exposed.
export type PatSummaryWire = {
  id: string
  name: string
  scopes: PatScope[]
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}
