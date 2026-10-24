// Calendar-month arithmetic on plain strings, shared by the server (the
// overview's monthly trend) and the client (the period picker). A month
// is `YYYY-MM`, a day `YYYY-MM-DD` — the wire format the API already
// uses — so nothing here touches time zones.

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM` of a `YYYY-MM-DD` (or of a month itself). */
export function monthOf(day: string): string {
  return day.slice(0, 7)
}

/** The month `n` months after `month` (negative goes back). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const index = y * 12 + (m - 1) + n
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
}

/** First day of the month, `YYYY-MM-01`. */
export function firstDayOf(month: string): string {
  return `${month}-01`
}

/** Last day of the month, e.g. `2024-02-29`. */
export function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  // Day 0 of the next month is the last day of this one.
  return `${month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`
}

/** Every month from `from` to `to`, both included, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let month = from; month <= to; month = addMonths(month, 1)) out.push(month)
  return out
}
