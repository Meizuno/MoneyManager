import { z } from 'zod'

// Income-category request shapes, shared across client and server.
// Inferred TS types live alongside each schema; do not redeclare.

// Create — POST /api/income-categories. Only the label is required;
// color and position are auto-assigned by the service from the
// caller's existing category count (next-in-palette colour, append
// to the end of the list).
export const createIncomeCategorySchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100)
})
export type CreateIncomeCategoryInput = z.infer<typeof createIncomeCategorySchema>

// Update — PUT /api/income-categories/[id]. Partial: only the keys
// present are written. At least one of them must be present, enforced
// in the service (zod allows the empty object; the service treats it
// as "nothing to update" and 400s).
export const updateIncomeCategorySchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100).optional()
})
export type UpdateIncomeCategoryInput = z.infer<typeof updateIncomeCategorySchema>

// Wire shape — what the API returns. Position drives the display
// order in the picker; color is one of the palette entries.
export type IncomeCategory = {
  id: number
  label: string
  color: string
  position: number
  created_at: string
}
