import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/ueber-uns/");
});

test("tapping a team card shows its contact links", async ({ page }) => {
  const first = page.locator(".team_div").first();
  const second = page.locator(".team_div").nth(1);
  // Tap on the photo, not on a link (the links are hidden before the tap).
  await first.locator("img").tap();
  await expect(first.locator(".team_links")).toBeVisible();
  await expect(first.locator(".team_text")).toBeHidden();

  await second.locator("img").tap();
  await expect(second.locator(".team_links")).toBeVisible();
  await expect(first.locator(".team_links")).toBeHidden();
  await expect(first.locator(".team_text")).toBeVisible();
});

test("team cards and philosophy icons stack in one column", async ({ page }) => {
  const widths = await page.evaluate(() =>
    [...document.querySelectorAll(".team_div, .services-icon")].map(
      (element) => element.getBoundingClientRect().width,
    ),
  );
  const content = await page.evaluate(
    () => document.querySelector(".main-container .row")!.getBoundingClientRect().width,
  );
  for (const width of widths) expect(width).toBeCloseTo(content, 0);
});
