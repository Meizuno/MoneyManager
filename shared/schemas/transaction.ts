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
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

// Amount: accept either a number or a string. Strings tolerate
// `"1 000,50"`-style locale formatting (spaces stripped, comma → dot)
// because the form on the client sometimes sends raw input. The
// service .abs()s and uses sign to infer type when caller omitted it.
export const amountSchema = z.union([z.number(), z.string()])
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

// Sentinel returned by parseCategoryId when the input is present but
// isn't a usable category id (a non-numeric string like "Food", or a
// negative / non-integer number). Distinct from `undefined`, which means
// "no category supplied" (→ uncategorised).
export const INVALID_CATEGORY_ID = Symbol('invalid-category-id')

// The single canonical category-id parser, shared by the REST schema
// (categorySchema, below) and the MCP tool boundary (toCategoryId), so
// the two surfaces can't drift:
//   - undefined / empty-or-whitespace string → undefined (uncategorised)
//   - a non-negative integer, or a numeric string → that integer
//   - anything else → INVALID_CATEGORY_ID
// The existence check (assertCategoryValid → CategoryNotFound) is a
// separate, downstream concern and is unaffected by this.
export function parseCategoryId(
  v: string | number | undefined
): number | undefined | typeof INVALID_CATEGORY_ID {
  if (v === undefined) return undefined
  if (typeof v === 'number') {
    return Number.isInteger(v) && v >= 0 ? v : INVALID_CATEGORY_ID
  }
  const trimmed = v.trim()
  if (trimmed === '') return undefined
  return /^\d+$/.test(trimmed) ? Number(trimmed) : INVALID_CATEGORY_ID
}

// Category: a non-negative integer id or a numeric string; empty /
// omitted means uncategorised. Anything else (e.g. a category NAME like
// "Food", a negative or non-integer) is REJECTED as a validation issue —
// the same rule the MCP boundary enforces, via the shared parseCategoryId
// — rather than silently collapsing to 0.
export const categorySchema = z.union([z.number(), z.string()])
  .transform((v, ctx) => {
    const parsed = parseCategoryId(v)
    if (parsed === INVALID_CATEGORY_ID) {
      ctx.addIssue({
        code: 'custom',
        message: 'category must be a numeric id from get_expense_categories / get_income_categories'
      })
      return z.NEVER
    }
    return parsed
  })

// Default currency applied when a transaction is created without one —
// the app is CZK-centric (the form pre-fills it, display falls back to
// it). Creating via the API or MCP with no currency stores this rather
// than null.
export const DEFAULT_CURRENCY = 'CZK'

// Currency is optional and nullable; empty/whitespace collapses to null.
export const currencySchema = z.string()
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
  // Optional on create. Omitted, the service takes the category of the
  // last transaction of the same type and name, else the user's default
  // for the type (resolveCategoryScoped); only when there is neither is
  // it an error. Every stored transaction still references a real one.
  category: categorySchema.optional()
})
// Post-validation type — what the service receives (numbers are
// already coerced, strings already trimmed). Use server-side.
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
// Pre-validation type — what the client builds before sending. The
// form's amount input is `number | string`, the category select gives
// us numeric strings, etc. Use client-side when typing emits/refs that
// haven't yet been through the schema.
export type CreateTransactionPayload = z.input<typeof createTransactionSchema>

// PUT /api/transactions/[id]. Same shape as create but every field
// optional: only the keys present in the body are written. Type
// changes move the row between the income/expense tables. An omitted
// category here keeps the row's own — nothing is looked up.
export const updateTransactionSchema = createTransactionSchema.partial()
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type UpdateTransactionPayload = z.input<typeof updateTransactionSchema>

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

// GET /api/transactions/suggest-category — what a transaction of this
// type and name would be filed under if created without a category, so
// the form can show it before anything is saved. An empty name asks only
// for the default.
export const suggestCategoryQuerySchema = z.object({
  type: transactionTypeSchema,
  name: z.string().trim().max(200).default('')
})
export type SuggestCategoryQuery = z.infer<typeof suggestCategoryQuerySchema>

// Where a category taken for a transaction came from: the last one of the
// same name, or the user's default for the type.
export type CategorySource = 'previous' | 'default'

// The answer to suggest-category: the category and why, or null when a
// transaction of that name would need one chosen.
export type CategorySuggestion = {
  category: { id: number, source: CategorySource } | null
}

// The summary endpoint takes the same filters as the list (the query
// schema is shared) but returns DB-side aggregates instead of rows, so
// the overview's totals don't depend on fetching every matching row.
// `income`/`expenses` are positive sums of the stored (absolute) amounts;
// `net` is income − expenses.
export type TransactionSummary = {
  income: number
  expenses: number
  net: number
  incomeCount: number
  expenseCount: number
}

// Income and expense totals for one calendar month (`YYYY-MM`), positive
// sums like TransactionSummary's. The overview's trend is a run of these.
export type MonthTotals = {
  month: string
  income: number
  expenses: number
}

// The transaction's category on read: the stored id plus its label,
// joined from the matching category table. id 0 is "uncategorised" and a
// since-deleted id resolves to an empty label. Writes still take a bare
// numeric id — see Create/UpdateTransactionInput.
export type TransactionCategory = {
  id: number
  label: string
}

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
  category: TransactionCategory
  // The recurring transaction that wrote it, or null for one entered by
  // hand. Editing or deleting it touches this one occurrence only.
  recurring_id: number | null
  created_at: string
}
