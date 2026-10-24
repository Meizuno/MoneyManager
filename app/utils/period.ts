import { addMonths, firstDayOf, lastDayOf } from "#shared/utils/months";

// The span of time a page shows, as it appears in the address
// (`?period=`): a month `YYYY-MM`, a year `YYYY`, or `all`.
export type Period = string;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;

export function isMonth(period: Period): boolean {
  return MONTH.test(period);
}

export function isYear(period: Period): boolean {
  return YEAR.test(period);
}

export function isPeriod(value: unknown, allowAll = true): value is Period {
  if (typeof value !== "string") return false;
  return MONTH.test(value) || YEAR.test(value) || (allowAll && value === "all");
}

/** The month it is where the code runs, `YYYY-MM`. */
export function currentMonth(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

/** The API's inclusive date filter for a period; `all` has none. */
export function periodRange(period: Period): { dateFrom?: string; dateTo?: string } {
  if (isMonth(period)) return { dateFrom: firstDayOf(period), dateTo: lastDayOf(period) };
  if (isYear(period)) return { dateFrom: `${period}-01-01`, dateTo: `${period}-12-31` };
  return {};
}

/** The months a period covers, for comparing a month against its plan. */
export function periodMonthCount(period: Period): number {
  return isMonth(period) ? 1 : isYear(period) ? 12 : 0;
}

/** One step back or forward, at the period's own size; `all` stays put. */
export function stepPeriod(period: Period, n: number): Period {
  if (isMonth(period)) return addMonths(period, n);
  if (isYear(period)) return String(Number(period) + n);
  return period;
}

const monthDate = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1));
};

/** "October 2026", "2026", "All time". */
export function periodLabel(period: Period): string {
  if (isMonth(period)) {
    return monthDate(period).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  if (isYear(period)) return period;
  return "All time";
}

/** "Oct" — for chart axes. */
export function shortMonthLabel(month: string): string {
  return monthDate(month).toLocaleString("en", { month: "short", timeZone: "UTC" });
}

/**
 * How far into the period today is, 0–1 — for the "today" mark on the
 * budget bars. Null for a period that isn't the current month or year.
 */
export function elapsedShare(period: Period, today = new Date()): number | null {
  const month = currentMonth(today);
  if (period === month) {
    const days = Number(lastDayOf(month).slice(8));
    return today.getDate() / days;
  }
  if (period === month.slice(0, 4)) {
    const start = Date.UTC(today.getFullYear(), 0, 1);
    const end = Date.UTC(today.getFullYear() + 1, 0, 1);
    return (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1) - start) / (end - start);
  }
  return null;
}
