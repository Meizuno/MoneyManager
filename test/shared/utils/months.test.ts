import { describe, it, expect } from 'vitest'
import { addMonths, firstDayOf, lastDayOf, monthOf, monthsBetween } from '../../../shared/utils/months'

describe('month arithmetic', () => {
  it('takes the month of a day', () => {
    expect(monthOf('2026-10-24')).toBe('2026-10')
    expect(monthOf('2026-10-24T08:00:00.000Z')).toBe('2026-10')
  })

  it('steps across year boundaries both ways', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-10', -11)).toBe('2025-11')
    expect(addMonths('2026-03', 0)).toBe('2026-03')
  })

  it('knows the first and last day, leap years included', () => {
    expect(firstDayOf('2026-02')).toBe('2026-02-01')
    expect(lastDayOf('2026-02')).toBe('2026-02-28')
    expect(lastDayOf('2024-02')).toBe('2024-02-29')
    expect(lastDayOf('2026-12')).toBe('2026-12-31')
  })

  it('lists the months of a range, both ends included', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthsBetween('2026-05', '2026-05')).toEqual(['2026-05'])
    expect(monthsBetween('2026-06', '2026-05')).toEqual([])
  })
})
