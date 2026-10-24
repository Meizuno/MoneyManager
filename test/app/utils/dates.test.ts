import { describe, it, expect } from 'vitest'
import { dayHeading, localDay, previousDay, shortDay } from '../../../app/utils/dates'

describe('days', () => {
  it('formats a moment as a local day', () => {
    expect(localDay(new Date(2026, 9, 4, 23, 30))).toBe('2026-10-04')
  })

  it('steps back across month and year ends', () => {
    expect(previousDay('2026-10-01')).toBe('2026-09-30')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
    expect(previousDay('2024-03-01')).toBe('2024-02-29')
  })

  it('heads a day as people say it', () => {
    const today = '2026-10-24'
    expect(dayHeading('2026-10-24', today)).toBe('Today')
    expect(dayHeading('2026-10-23', today)).toBe('Yesterday')
    // ICU versions differ on the comma after the weekday.
    expect(dayHeading('2026-10-20', today)).toMatch(/^Tuesday,? 20 October$/)
    expect(dayHeading('2025-12-31', today)).toMatch(/^Wednesday,? 31 December 2025$/)
  })

  it('shortens a day for a chip', () => {
    expect(shortDay('2026-10-23')).toBe('23 Oct 2026')
  })
})
