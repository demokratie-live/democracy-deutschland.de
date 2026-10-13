import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import yaml from "yaml";
import {
  donationStatusJson,
  phpJsonEncode,
  phpNumberFormat,
  phpRound,
  percentage,
} from "./donation";
import { donationSchema, type Donation } from "./schemas/donation";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf-8");
const donation = donationSchema.parse(yaml.parse(read("content/donate/donation.yaml")));

/**
 * Response of https://democracy-deutschland.de/api.php?call=donation_status
 * from 2026-10-13, byte for byte (PHP 7.4.33). Reference for the format and
 * the calculation; the current figures live in content/donate/donation.yaml.
 */
const LIVE = read("tests/fixtures/donation_status.live.json");

/** What the SAI held for that response: the live result without the computed percentages. */
function liveInputs(): Donation {
  const result = JSON.parse(LIVE).result;
  delete result.donation_percentage;
  for (const row of result.donation_data) delete row.percentage;
  return donationSchema.parse(result);
}

// Reference values from PHP 7.4.33 (the version live runs): round($v / $m * 100, 0).
// Math.round() gets all of these wrong, PHP pre-rounds to 15 significant digits.
const PHP_ROUND_CASES: [value: number, max: number, rounded: number][] = [
  [23, 40, 58],
  [46, 80, 58],
  [69, 120, 58],
  [92, 160, 58],
  [29, 200, 15],
  [57, 200, 29],
  [113, 200, 57],
  [115, 200, 58],
  [58, 400, 15],
  [114, 400, 29],
  [226, 400, 57],
  [230, 400, 58],
  [116, 800, 15],
  [228, 800, 29],
  [452, 800, 57],
  [460, 800, 58],
  [145, 1000, 15],
  [285, 1000, 29],
  [565, 1000, 57],
  [575, 1000, 58],
  [290, 2000, 15],
  [570, 2000, 29],
  [1130, 2000, 57],
  [1150, 2000, 58],
  [435, 3000, 15],
  [855, 3000, 29],
  [1695, 3000, 57],
  [1725, 3000, 58],
  [1450, 10000, 15],
  [2850, 10000, 29],
  [5650, 10000, 57],
  [5750, 10000, 58],
  // live values
  [1563, 9300, 17],
  [150, 650, 23],
  [650, 650, 100],
  [0, 3000, 0],
];

test("percentages round like PHP 7.4 round()", () => {
  for (const [value, max, rounded] of PHP_ROUND_CASES) {
    assert.equal(percentage(value, max), rounded, `${value}/${max}`);
  }
});

test("phpRound rounds half away from zero and leaves huge values alone", () => {
  // PHP 7.4.33: round($x, 0)
  const cases: [number, number][] = [
    [0.5, 1],
    [1.5, 2],
    [2.5, 3],
    [-0.5, -1],
    [-1.5, -2],
    [17.5, 18],
    [22.499999999999996, 23],
    [0.49999999999999994, 1],
    [0.1 + 0.2, 0],
    [123456789012345.5, 123456789012346],
    [1e15 + 0.5, 1e15 + 0.5],
  ];
  for (const [input, expected] of cases) assert.equal(phpRound(input), expected, String(input));
});

test("phpNumberFormat matches number_format($n, 0, ',', '.')", () => {
  const cases: [number, string][] = [
    [0, "0"],
    [999, "999"],
    [1000, "1.000"],
    [1563, "1.563"],
    [9300, "9.300"],
    [12345678, "12.345.678"],
    [1234.5, "1.235"],
    [999.5, "1.000"],
  ];
  for (const [input, expected] of cases) assert.equal(phpNumberFormat(input), expected);
});

test("phpJsonEncode escapes like json_encode() without flags", () => {
  // Output of PHP 7.4.33 json_encode() for the same array.
  assert.equal(
    phpJsonEncode({
      a: "4.000 SMS á 7,8 ct",
      b: "(1.750€ netto) / Monat",
      c: '😀 "q" \\ \t\n',
      d: 100.0,
      e: 0,
      f: 17.0,
      g: 0.01362,
    }),
    // (no String.raw: tsx/esbuild cooks its \u escapes)
    '{"a":"4.000 SMS \\u00e1 7,8 ct","b":"(1.750\\u20ac netto) \\/ Monat",' +
      '"c":"\\ud83d\\ude00 \\"q\\" \\\\ \\t\\n","d":100,"e":0,"f":17,"g":0.01362}',
  );
});

test("the live inputs produce the live response byte for byte (except querytime)", () => {
  const live = LIVE.replace(/^\{"querytime":[0-9.]+,/, '{"querytime":0,');
  assert.equal(donationStatusJson(liveInputs()), live);
});

test("donation.yaml produces JSON with the types of the live response", () => {
  const typesOf = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(typesOf)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typesOf(v)]))
        : typeof value;
  assert.deepEqual(typesOf(JSON.parse(donationStatusJson(donation))), typesOf(JSON.parse(LIVE)));
});

test("rows are sorted by order and headings get percentage 0", () => {
  const shuffled: Donation = {
    ...donation,
    donation_data: [...donation.donation_data].reverse(),
  };
  const rows = JSON.parse(donationStatusJson(shuffled)).result.donation_data;
  assert.deepEqual(
    rows.map((row: { order: number }) => row.order),
    [...rows.map((row: { order: number }) => row.order)].sort((a, b) => a - b),
  );
  for (const row of rows) if (row.type === 0) assert.equal(row.percentage, 0);
});

test("schema rejects what would break the PHP calculation", () => {
  const base = yaml.parse(read("content/donate/donation.yaml"));
  const withItem = (item: object) => ({ ...base, donation_data: [...base.donation_data, item] });
  assert.throws(() => donationSchema.parse(withItem({ id: 99, order: 99, type: 1, max: 0 })));
  assert.throws(() => donationSchema.parse(withItem({ id: 6, order: 99, type: 0 })));
  assert.throws(() =>
    donationSchema.parse(withItem({ id: 99, order: 99, type: 1, value: "5", max: 9 })),
  );
  assert.throws(() => donationSchema.parse({ ...base, donation_value_goal: 0 }));
});
