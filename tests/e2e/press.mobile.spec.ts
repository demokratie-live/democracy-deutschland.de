import { expect, test } from "@playwright/test";

test("press tiles stack in one column", async ({ page }) => {
  await page.goto("/presse/");
  const widths = await page.evaluate(() =>
    [...document.querySelectorAll(".main-container .col-md-4")].map(
      (element) => element.getBoundingClientRect().width,
    ),
  );
  const row = await page.evaluate(
    () => document.querySelector(".main-container .row")!.getBoundingClientRect().width,
  );
  expect(widths.length).toBeGreaterThan(40);
  for (const width of widths) expect(width).toBeCloseTo(row, 0);
});
