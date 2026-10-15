/**
 * Status codes of the roadmap table (content/engineering/roadmap.yaml).
 * Port of default_engineering::icon_class() in democracy-website: the tens
 * pick the icon, the ones the colour; 0 is an empty cell.
 */

/** Tens digit → Font Awesome icon (codes 1–5, 11–15, …, 71–75). */
const ICONS = [
  "fa-check-square",
  "fa-square",
  "fa-pencil-square",
  "fa-plus-square",
  "fa-minus-square",
  "fa-odnoklassniki-square",
  "fa-github-square",
  "fa-times-circle",
];

/** Ones digit → colour class of the template's <style> block. */
const COLORS: Record<number, string> = {
  1: "rmicon-blue",
  2: "rmicon-grey",
  3: "rmicon-red",
  4: "rmicon-green",
  5: "rmicon-green",
};

function isIconCode(code: number): boolean {
  return Number.isInteger(code) && code >= 1 && code < ICONS.length * 10 && code % 10 in COLORS;
}

/** Codes the roadmap may use: 0 (empty) or one that icon_class() maps to an icon. */
export function isRoadmapCode(code: number): boolean {
  return code === 0 || isIconCode(code);
}

/**
 * Classes of a status code exactly like icon_class(): "<icon> <colour>", and
 * " " for codes without icon. The template puts the result after "fa ", so an
 * empty cell has class="fa  ".
 */
export function iconClass(code: number): string {
  if (!isIconCode(code)) return " ";
  return `${ICONS[Math.floor(code / 10)]} ${COLORS[code % 10]}`;
}
