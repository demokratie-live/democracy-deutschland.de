import { DONATION_TYPE_DATA, type Donation, type DonationItem } from "./schemas/donation";

/**
 * Donation figures as computed by the PHP site: default_donate.php (page) and
 * api_democracy.php::call_donation_status() (JSON for the app). Both pages
 * and the JSON use the same rounding, so the numbers always agree.
 */

const roundHalfAwayFromZero = (value: number) =>
  value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);

/**
 * PHP 7.4 `round($value, 0)` (_php_math_round): pre-rounds to 15 significant
 * digits, then rounds half away from zero. The pre-rounding is why PHP turns
 * 22.499999999999996 into 23 where Math.round() gives 22.
 */
export function phpRound(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const precision = 14 - Math.floor(Math.log10(Math.abs(value)));
  if (precision > 0 && precision < 15) {
    const factor = Number(`1e${precision}`);
    return roundHalfAwayFromZero(roundHalfAwayFromZero(value * factor) / factor);
  }
  // Beyond double precision rounding changes nothing.
  if (Math.abs(value) >= 1e15) return value;
  return roundHalfAwayFromZero(value);
}

/** PHP `number_format($value, 0, ',', '.')`, e.g. 9300 → "9.300". */
export function phpNumberFormat(value: number): string {
  const rounded = phpRound(value);
  const digits = Math.abs(rounded)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+$)/g, ".");
  return rounded < 0 ? `-${digits}` : digits;
}

/**
 * PHP `json_encode()` with default flags: like JSON.stringify(), but "/" is
 * escaped and every non-ASCII character becomes \uXXXX (lowercase). The output
 * is pure ASCII, so it parses the same whatever charset a server announces.
 */
export function phpJsonEncode(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\//g, "\\/")
    .replace(/[\u0080-￿]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/** `round(value / goal * 100, 0)`; PHP divides as floats. */
export const percentage = (value: number, goal: number) => phpRound((value / goal) * 100);

/** Rows in the order of `SELECT * FROM donate ORDER BY order`. */
export function sortedItems(donation: Donation): DonationItem[] {
  return [...donation.donation_data].sort((a, b) => a.order - b.order);
}

/** Bar width of a row: percentage for posts, 0 for headings (like PHP). */
export const itemPercentage = (item: DonationItem) =>
  item.type === DONATION_TYPE_DATA ? percentage(item.value, item.max) : 0;

/** `result` of api.php?call=donation_status, keys in the order PHP emits them. */
export function donationStatusResult(donation: Donation) {
  return {
    donation_date: donation.donation_date,
    donation_paten: donation.donation_paten,
    donation_paten_goal: donation.donation_paten_goal,
    donation_value: donation.donation_value,
    donation_value_goal: donation.donation_value_goal,
    donation_percentage: percentage(donation.donation_value, donation.donation_value_goal),
    donation_data: sortedItems(donation).map((item) => ({
      id: item.id,
      order: item.order,
      type: item.type,
      value: item.value,
      max: item.max,
      text_cost: item.text_cost,
      text_description: item.text_description,
      text_description_subtext: item.text_description_subtext,
      text_date: item.text_date,
      percentage: itemPercentage(item),
    })),
  };
}

/**
 * Body of api.php?call=donation_status (SYSTEM\LOG\JsonResult::toString).
 * `querytime` is the PHP execution time on live; a static file has none, so
 * it is 0 (still a number for the app).
 */
export function donationStatusJson(donation: Donation): string {
  return phpJsonEncode({ querytime: 0, status: true, result: donationStatusResult(donation) });
}
