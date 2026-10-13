import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/engineering/");
});

test("mobile layout: smaller roadmap heads, one Alpha label, no laptop image", async ({ page }) => {
  await expect(page.locator("th.rotate").first()).toHaveCSS("font-size", "12px");
  const table = (await page.locator("table.table").boundingBox())!;
  expect(table.x + table.width).toBeLessThanOrEqual(375);
  await expect(page.locator(".badges2 span").first()).toBeVisible();
  await expect(page.locator("#secondbadge span")).toBeHidden();
  await expect(page.locator('img[src="/files/images/macbookSpaceGrey@3x.png"]')).toBeHidden();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBe(375);
});

test("tapping a field and sending without input shows the first alert", async ({ page }) => {
  const alerts: string[] = [];
  page.once("dialog", async (dialog) => {
    alerts.push(dialog.message());
    await dialog.dismiss();
  });
  await page.locator("#vol-send").tap();
  await expect.poll(() => alerts).toEqual(["Bitte einen Vornamen eingeben"]);
  await expect(page.locator("#vol-name")).toBeFocused();
});
