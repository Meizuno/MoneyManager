import { describe, it, expect } from 'vitest'
import { firstOnOrAfter, nextOccurrence, occurrencesThrough, todayIn } from '../../../shared/utils/recurrence'

describe('nextOccurrence', () => {
  it('counts days and weeks, across months and years', () => {
    expect(nextOccurrence('2026-01-31', '2026-01-31', 'day', 1)).toBe('2026-02-01')
    expect(nextOccurrence('2026-12-30', '2026-12-30', 'day', 3)).toBe('2027-01-02')
    expect(nextOccurrence('2026-02-25', '2026-02-25', 'week', 1)).toBe('2026-03-04')
    expect(nextOccurrence('2026-11-01', '2026-11-01', 'week', 2)).toBe('2026-11-15')
  })

  it('keeps the day of the month', () => {
    expect(nextOccurrence('2026-01-15', '2026-01-15', 'month', 1)).toBe('2026-02-15')
    expect(nextOccurrence('2026-11-15', '2026-01-15', 'month', 3)).toBe('2027-02-15')
  })

  it('takes the last day where the month is short, and goes back to the start day after', () => {
    expect(nextOccurrence('2026-01-31', '2026-01-31', 'month', 1)).toBe('2026-02-28')
    expect(nextOccurrence('2026-02-28', '2026-01-31', 'month', 1)).toBe('2026-03-31')
    expect(nextOccurrence('2026-03-31', '2026-01-31', 'month', 1)).toBe('2026-04-30')
    expect(nextOccurrence('2024-01-31', '2024-01-31', 'month', 1)).toBe('2024-02-29')
  })

  it('handles leap days yearly', () => {
    expect(nextOccurrence('2024-02-29', '2024-02-29', 'year', 1)).toBe('2025-02-28')
    expect(nextOccurrence('2027-02-28', '2024-02-29', 'year', 1)).toBe('2028-02-29')
    expect(nextOccurrence('2026-06-10', '2026-06-10', 'year', 2)).toBe('2028-06-10')
  })
})

describe('occurrencesThrough', () => {
  const monthly = { start: '2026-08-31', unit: 'month' as const, every: 1 }

  it('lists every one that has come due, and where the schedule then stands', () => {
    expect(occurrencesThrough('2026-08-31', '2026-11-01', monthly)).toEqual({
      dates: ['2026-08-31', '2026-09-30', '2026-10-31'],
      next: '2026-11-30'
    })
  })

  it('writes nothing before the next one is due', () => {
    expect(occurrencesThrough('2026-11-30', '2026-11-01', monthly)).toEqual({ dates: [], next: '2026-11-30' })
  })

  it('stops at the end date, the end date itself included', () => {
    expect(occurrencesThrough('2026-08-31', '2026-12-31', { ...monthly, end: '2026-09-30' }).dates)
      .toEqual(['2026-08-31', '2026-09-30'])
  })
})

describe('firstOnOrAfter', () => {
  it('skips what a pause slept through', () => {
    expect(firstOnOrAfter('2026-08-01', '2026-11-02', { start: '2026-08-01', unit: 'month', every: 1 })).toBe('2026-12-01')
    expect(firstOnOrAfter('2026-08-01', '2026-11-01', { start: '2026-08-01', unit: 'month', every: 1 })).toBe('2026-11-01')
  })

  it('leaves a future date as it is', () => {
    expect(firstOnOrAfter('2026-12-01', '2026-11-01', { start: '2026-08-01', unit: 'month', every: 1 })).toBe('2026-12-01')
  })
})

describe('todayIn', () => {
  it('is the date in that zone, not in UTC', () => {
    // 23:30 UTC on the 31st is already the 1st in Prague.
    const late = new Date('2026-10-31T23:30:00Z')
    expect(todayIn('Europe/Prague', late)).toBe('2026-11-01')
    expect(todayIn('UTC', late)).toBe('2026-10-31')
  })

  it('falls back to UTC for a zone it does not know', () => {
    expect(todayIn('Not/AZone', new Date('2026-10-31T23:30:00Z'))).toBe('2026-10-31')
  })
})
