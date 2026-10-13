import assert from "node:assert/strict";
import { test } from "node:test";
import { iconClass, isRoadmapCode } from "./roadmap";

/**
 * Output of the original default_engineering::icon_class() for every code
 * from -1 to 80 that is not " " (PHP 7.4, docker php:7.4-cli, see AGENTS.md).
 */
const PHP: Record<number, string> = {
  1: "fa-check-square rmicon-blue",
  2: "fa-check-square rmicon-grey",
  3: "fa-check-square rmicon-red",
  4: "fa-check-square rmicon-green",
  5: "fa-check-square rmicon-green",
  11: "fa-square rmicon-blue",
  12: "fa-square rmicon-grey",
  13: "fa-square rmicon-red",
  14: "fa-square rmicon-green",
  15: "fa-square rmicon-green",
  21: "fa-pencil-square rmicon-blue",
  22: "fa-pencil-square rmicon-grey",
  23: "fa-pencil-square rmicon-red",
  24: "fa-pencil-square rmicon-green",
  25: "fa-pencil-square rmicon-green",
  31: "fa-plus-square rmicon-blue",
  32: "fa-plus-square rmicon-grey",
  33: "fa-plus-square rmicon-red",
  34: "fa-plus-square rmicon-green",
  35: "fa-plus-square rmicon-green",
  41: "fa-minus-square rmicon-blue",
  42: "fa-minus-square rmicon-grey",
  43: "fa-minus-square rmicon-red",
  44: "fa-minus-square rmicon-green",
  45: "fa-minus-square rmicon-green",
  51: "fa-odnoklassniki-square rmicon-blue",
  52: "fa-odnoklassniki-square rmicon-grey",
  53: "fa-odnoklassniki-square rmicon-red",
  54: "fa-odnoklassniki-square rmicon-green",
  55: "fa-odnoklassniki-square rmicon-green",
  61: "fa-github-square rmicon-blue",
  62: "fa-github-square rmicon-grey",
  63: "fa-github-square rmicon-red",
  64: "fa-github-square rmicon-green",
  65: "fa-github-square rmicon-green",
  71: "fa-times-circle rmicon-blue",
  72: "fa-times-circle rmicon-grey",
  73: "fa-times-circle rmicon-red",
  74: "fa-times-circle rmicon-green",
  75: "fa-times-circle rmicon-green",
};

test("iconClass: same classes as icon_class() for every code", () => {
  for (let code = -1; code <= 80; code++) {
    assert.equal(iconClass(code), PHP[code] ?? " ", `code ${code}`);
  }
});

test("iconClass: empty cell keeps the two spaces of the template", () => {
  assert.equal(`fa ${iconClass(0)}`, "fa  ");
});

test("isRoadmapCode: 0 and every code with an icon", () => {
  const known = Object.keys(PHP).map(Number);
  for (let code = -1; code <= 80; code++) {
    assert.equal(isRoadmapCode(code), code === 0 || known.includes(code), `code ${code}`);
  }
  assert.equal(isRoadmapCode(1.5), false);
});
