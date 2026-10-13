/** Dates and labels of the blog as WordPress (de_DE) prints them. */

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** `get_the_date()` with the format "j. F Y": "2026-06-14T10:20:02" → "14. Juni 2026". */
export function formatPostDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return `${day}. ${MONTHS[month - 1]} ${year}`;
}

/** Monthly archive label "F Y": "2026-06" → "Juni 2026". */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Offset of Europe/Berlin from UTC in ms at the instant `utc`. */
function berlinOffset(utc: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return local - utc;
}

/** Local time of the blog ("2026-06-14T10:20:02", Europe/Berlin) as a UTC Date (post_date_gmt). */
export function berlinToUtc(local: string): Date {
  const [date, time] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = asUtc - berlinOffset(asUtc);
  return new Date(asUtc - berlinOffset(first));
}

/** RFC 2822 date of the feeds: "Sun, 14 Jun 2026 08:20:02 +0000". */
export function formatRfc2822(date: Date): string {
  return date.toUTCString().replace("GMT", "+0000");
}
