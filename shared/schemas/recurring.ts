import { z } from 'zod'
import { RECURRENCE_UNITS } from '../utils/recurrence'
import {
  amountSchema,
  categorySchema,
  currencySchema,
  isoDateSchema,
  transactionTypeSchema,
  type TransactionCategory,
  type TransactionType
} from './transaction'

// Recurring-transaction request shapes, shared across client and server.
// A recurring transaction is a rule — "Rent, 15 000 CZK, every month from
// the 1st" — and the server writes each occurrence as an ordinary income
// or expense when it comes due (server/utils/recurring.ts).

export const recurrenceUnitSchema = z.enum(RECURRENCE_UNITS)

const everySchema = z.coerce.number().int().min(1, 'Every must be at least 1').max(999)

// The amount of each occurrence: positive, the type says which way it goes.
const positiveAmountSchema = amountSchema.refine(n => n > 0, { message: 'Amount must be above zero' })

// POST /api/recurring. The category is optional as on a transaction: left
// out, the rule takes the one the same name had last time, else the default
// (resolveCategoryScoped), once, when it is made. The first occurrence is
// the start date itself; one already due is written straight away.
export const createRecurringSchema = z.object({
  type: transactionTypeSchema,
  name: z.string().trim().min(1, 'Name is required'),
  amount: positiveAmountSchema,
  currency: currencySchema,
  category: categorySchema.optional(),
  unit: recurrenceUnitSchema,
  every: everySchema.default(1),
  start_date: isoDateSchema,
  end_date: isoDateSchema.nullable().optional()
}).refine(r => !r.end_date || r.end_date >= r.start_date, {
  message: 'The end date cannot be before the start date',
  path: ['end_date']
})
export type CreateRecurringInput = z.infer<typeof createRecurringSchema>
export type CreateRecurringPayload = z.input<typeof createRecurringSchema>

// PUT /api/recurring/[id]. What it writes and whether it runs — not when:
// the schedule (unit, every, start) is fixed once made, because moving it
// would leave the occurrences already written on the old one. A different
// schedule is a new rule. Every field optional; the service 400s on none.
export const updateRecurringSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  amount: positiveAmountSchema.optional(),
  currency: currencySchema,
  category: categorySchema.optional(),
  // null takes the end date away: it runs on until stopped.
  end_date: isoDateSchema.nullable().optional(),
  paused: z.boolean().optional()
})
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>
export type UpdateRecurringPayload = z.input<typeof updateRecurringSchema>

// Wire shape. `next_date` is the next occurrence to be written, or null once
// the end date has passed it — the rule has run its course.
export type RecurringTransaction = {
  id: number
  type: TransactionType
  name: string
  amount: number
  currency: string | null
  category: TransactionCategory
  unit: z.infer<typeof recurrenceUnitSchema>
  every: number
  start_date: string
  end_date: string | null
  next_date: string | null
  paused: boolean
  created_at: string
}
