import { describe, it, expect } from 'vitest'
import {
  currentMonth,
  elapsedShare,
  isPeriod,
  periodLabel,
  periodMonthCount,
  periodRange,
  stepPeriod
} from '../../../app/utils/period'

describe('periods', () => {
  it('accepts months, years and, where allowed, all time', () => {
    expect(isPeriod('2026-10')).toBe(true)
    expect(isPeriod('2026')).toBe(true)
    expect(isPeriod('all')).toBe(true)
    expect(isPeriod('all', false)).toBe(false)
    expect(isPeriod('2026-13')).toBe(false)
    expect(isPeriod('2026-1')).toBe(false)
    expect(isPeriod(['2026-10'])).toBe(false)
    expect(isPeriod(undefined)).toBe(false)
  })

  it('turns a period into the API date filter', () => {
    expect(periodRange('2026-02')).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' })
    expect(periodRange('2024')).toEqual({ dateFrom: '2024-01-01', dateTo: '2024-12-31' })
    expect(periodRange('all')).toEqual({})
  })

  it('steps at the period own size', () => {
    expect(stepPeriod('2026-01', -1)).toBe('2025-12')
    expect(stepPeriod('2026-12', 1)).toBe('2027-01')
    expect(stepPeriod('2026', -1)).toBe('2025')
    expect(stepPeriod('all', 1)).toBe('all')
  })

  it('labels periods for people', () => {
    expect(periodLabel('2026-10')).toBe('October 2026')
    expect(periodLabel('2026')).toBe('2026')
    expect(periodLabel('all')).toBe('All time')
    expect(periodMonthCount('2026-10')).toBe(1)
    expect(periodMonthCount('2026')).toBe(12)
  })

  it('knows the current month where it runs', () => {
    expect(currentMonth(new Date(2026, 9, 24))).toBe('2026-10')
    expect(currentMonth(new Date(2027, 0, 1))).toBe('2027-01')
  })

  it('places today within the current month or year, and nowhere else', () => {
    const today = new Date(2026, 9, 24)
    expect(elapsedShare('2026-10', today)).toBeCloseTo(24 / 31)
    expect(elapsedShare('2026', today)).toBeGreaterThan(0.8)
    expect(elapsedShare('2026', today)).toBeLessThan(0.82)
    expect(elapsedShare('2026-09', today)).toBeNull()
    expect(elapsedShare('all', today)).toBeNull()
  })
})
