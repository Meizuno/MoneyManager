// When a recurring transaction comes round. Pure date arithmetic on
// `YYYY-MM-DD` strings, shared by the server (which writes the occurrences)
// and the client (which says when the next one is), so the two cannot
// disagree about a date.
//
// Days and weeks are a fixed number of days. Months and years keep the day
// of the start date — the 15th stays the 15th — and where a month is too
// short for it, take the month's last day: a schedule started on 31 January
// runs 28 (or 29) February, 31 March, 30 April. The day is read from the
// start each time rather than carried from the previous occurrence, so one
// short month does not pull every later one back to the 28th.

export const RECURRENCE_UNITS = ['day', 'week', 'month', 'year'] as const
export type RecurrenceUnit = typeof RECURRENCE_UNITS[number]

// A daily schedule over many years is a few thousand steps; anything beyond
// this is a schedule gone wrong, and a loop that stops is better than one
// that does not.
export const MAX_OCCURRENCES = 5000

const DAY_MS = 86_400_000

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y!, m!, d!]
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function format(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// The occurrence after `date` on a schedule started at `start`.
export function nextOccurrence(date: string, start: string, unit: RecurrenceUnit, every: number): string {
  const [y, m, d] = parts(date)
  if (unit === 'day' || unit === 'week') {
    const step = (unit === 'day' ? 1 : 7) * every
    return new Date(Date.UTC(y, m - 1, d) + step * DAY_MS).toISOString().slice(0, 10)
  }
  const months = (m - 1) + (unit === 'month' ? every : 12 * every)
  const year = y + Math.floor(months / 12)
  const month = (months % 12) + 1
  const anchor = parts(start)[2]
  return format(year, month, Math.min(anchor, daysInMonth(year, month)))
}

// Every occurrence from `from` (itself one) up to and including `until`,
// stopping at `end` when there is one; and the first occurrence after them,
// which is where the schedule stands afterwards.
export function occurrencesThrough(
  from: string,
  until: string,
  schedule: { start: string, unit: RecurrenceUnit, every: number, end?: string | null }
): { dates: string[], next: string } {
  const dates: string[] = []
  let next = from
  while (next <= until && (!schedule.end || next <= schedule.end) && dates.length < MAX_OCCURRENCES) {
    dates.push(next)
    next = nextOccurrence(next, schedule.start, schedule.unit, schedule.every)
  }
  return { dates, next }
}

// The first occurrence on or after `day`, counting on from `from` — where a
// schedule resumes after a pause, without the occurrences it slept through.
export function firstOnOrAfter(
  from: string,
  day: string,
  schedule: { start: string, unit: RecurrenceUnit, every: number }
): string {
  let next = from
  for (let i = 0; next < day && i < MAX_OCCURRENCES; i++) {
    next = nextOccurrence(next, schedule.start, schedule.unit, schedule.every)
  }
  return next
}

// Today as a date in `timeZone` — what "today" means for a schedule. An
// unknown zone falls back to UTC rather than stopping every schedule.
export function todayIn(timeZone: string, now = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  }
  catch {
    return now.toISOString().slice(0, 10)
  }
}
