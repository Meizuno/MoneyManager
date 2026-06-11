import { z } from 'zod'

// Single source of truth for Transaction request shapes + the type
// discriminator, shared across client (`#shared/schemas/transaction`)
// and server. Inferred TS types live alongside each schema — do not
// redeclare them by hand.

// Income vs expense — kept as a string literal union (not a Prisma
// native enum) because Prisma stores them in separate tables; the
// "type" is purely a transport-level discriminator.
export const TRANSACTION_TYPES = ['income', 'expense'] as const
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES)
export type TransactionType = z.infer<typeof transactionTypeSchema>

// YYYY-MM-DD as a string. We don't coerce to Date here — the wire
// format is ISO-date and the service converts to a real Date when it
// reaches Prisma. Keeping it a string lets the schema be reused on the
// client for form state without an extra serialisation hop.
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

// Amount: accept either a number or a string. Strings tolerate
// `"1 000,50"`-style locale formatting (spaces stripped, comma → dot)
// because the form on the client sometimes sends raw input. The
// service .abs()s and uses sign to infer type when caller omitted it.
const amountSchema = z.union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === 'number'
      ? v
      : Number(v.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: 'custom', message: 'Amount must be a finite number' })
      return z.NEVER
    }
    return n
  })

// Category: accept either a non-negative int or a numeric string;
// anything else collapses to 0 (the "uncategorised" bucket) — same
// behaviour as the old normalizeTransactionInput, just expressed
// declaratively.
const categorySchema = z.union([z.number().int(), z.string()])
  .transform((v) => {
    if (typeof v === 'number') return v >= 0 && Number.isInteger(v) ? v : 0
    const trimmed = v.trim()
    return /^\d+$/.test(trimmed) ? Number(trimmed) : 0
  })

// Currency is optional and nullable; empty/whitespace collapses to null.
const currencySchema = z.string()
  .transform(v => v.trim())
  .transform(v => v.length > 0 ? v : null)
  .nullable()
  .optional()

// POST /api/transactions. Type is optional — when omitted the service
// derives it from the amount's sign (negative → expense, else income),
// matching long-standing API behaviour.
export const createTransactionSchema = z.object({
  date: isoDateSchema,
  name: z.string().trim().min(1, 'Name is required'),
  amount: amountSchema,
  currency: currencySchema,
  type: transactionTypeSchema.optional(),
  category: categorySchema.optional()
})
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>

// PUT /api/transactions/[id]. Same shape as create but every field
// optional: only the keys present in the body are written. Type
// changes move the row between the income/expense tables.
export const updateTransactionSchema = createTransactionSchema.partial()
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>

// GET /api/transactions — filter params, all optional. Query values
// arrive as strings so anything numeric coerces; `category=all` (or
// missing / empty / non-numeric) clears the filter.
export const listTransactionsQuerySchema = z.object({
  type: transactionTypeSchema.optional(),
  category: z.union([z.string(), z.number()]).optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : undefined
      const t = v.trim()
      if (!t || t === 'all') return undefined
      return /^\d+$/.test(t) ? Number(t) : undefined
    }),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional()
})
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>

// Wire shape — what the API returns. `created_at` is ISO; `amount` is
// already-converted Number (Prisma's Decimal is serialized at the
// service boundary).
export type Transaction = {
  id: number
  date: string
  name: string
  amount: number
  currency: string | null
  type: TransactionType
  category: string
  created_at: string
}
