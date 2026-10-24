// Days as the API sends them (`YYYY-MM-DD`), labelled for people. Parsed
// as UTC midnight and formatted in UTC, so a day never shifts by the
// viewer's time zone.
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

// Made once: a list of a thousand transactions heads hundreds of days.
const longDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const longDayWithYear = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Today (or another moment) as `YYYY-MM-DD`, in the viewer's own time zone. */
export function localDay(moment = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
}

/** The day before a `YYYY-MM-DD`. */
export function previousDay(day: string): string {
  const d = asDate(day);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** "Today", "Yesterday", else "Thursday, 23 October" (with the year when it isn't this one). */
export function dayHeading(day: string, today = localDay()): string {
  if (day === today) return "Today";
  if (day === previousDay(today)) return "Yesterday";
  return (day.slice(0, 4) === today.slice(0, 4) ? longDay : longDayWithYear).format(asDate(day));
}

/** "23 Oct 2026". */
export function shortDay(day: string): string {
  return shortDayFormat.format(asDate(day));
}
