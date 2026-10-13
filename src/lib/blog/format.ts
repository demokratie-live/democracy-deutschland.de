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
