import { describe, it, expect } from 'vitest'
import type { Transaction } from '../../../shared/schemas/transaction'
import { budgetRows, incomeRows, unallocated } from '../../../app/utils/budget'

const tx = (type: 'income' | 'expense', category: number, amount: number, id = Math.random()): Transaction => ({
  id, date: '2026-10-01', name: 'x', amount, currency: 'CZK', type, category: { id: category, label: '' }, created_at: ''
})

const rules = [
  { id: 1, label: 'Rent', percent: 25, color: 'cyan' },
  { id: 2, label: 'Groceries', percent: 14, color: 'emerald' }
]

describe('budgetRows', () => {
  it('plans each category as its share of the income and sums what was spent', () => {
    const items = [tx('expense', 1, 16900), tx('expense', 2, 100.1), tx('expense', 2, 200.2), tx('income', 2, 999)]
    expect(budgetRows(rules, items, 79100)).toEqual([
      { id: 1, label: 'Rent', color: '#06b6d4', planned: 19775, spent: 16900 },
      { id: 2, label: 'Groceries', color: '#10b981', planned: 11074, spent: 300.3 }
    ])
  })

  it('keeps the user order and shows untouched categories at zero', () => {
    const rows = budgetRows([...rules].reverse(), [], 1000)
    expect(rows.map(r => r.label)).toEqual(['Groceries', 'Rent'])
    expect(rows.every(r => r.spent === 0)).toBe(true)
  })

  it('accepts percents that arrive as strings (Prisma decimals)', () => {
    const rows = budgetRows([{ id: 1, label: 'Rent', percent: '25.00' as unknown as number, color: 'cyan' }], [], 1000)
    expect(rows[0]!.planned).toBe(250)
  })
})

describe('incomeRows', () => {
  it('sums income per category and ignores expenses that share an id', () => {
    const categories = [{ id: 2, label: 'Salary', color: 'emerald' }, { id: 3, label: 'Interest', color: 'teal' }]
    expect(incomeRows(categories, [tx('income', 2, 68000), tx('expense', 2, 50)])).toEqual([
      { id: 2, label: 'Salary', color: '#10b981', amount: 68000 },
      { id: 3, label: 'Interest', color: '#14b8a6', amount: 0 }
    ])
  })
})

describe('unallocated', () => {
  it('is what no category plans for', () => {
    expect(unallocated(rules, 1000)).toEqual({ percent: 61, amount: 610 })
  })

  it('is nothing when the plan uses all of it or more', () => {
    expect(unallocated([{ id: 1, label: 'All', percent: 100, color: 'cyan' }], 1000)).toBeNull()
    expect(unallocated([{ id: 1, label: 'Too much', percent: 120, color: 'cyan' }], 1000)).toBeNull()
  })
})
