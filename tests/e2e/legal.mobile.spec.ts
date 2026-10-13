import { expect, test } from "@playwright/test";

test("legal texts render on a phone without errors", async ({ page }) => {
  for (const path of ["/impressum/", "/datenschutz/", "/nutzungsbedingungen/"]) {
    await page.goto(path);
    await expect(page.locator("#content .main-container > :is(h1, h2)").first()).toBeVisible();
  }
});
