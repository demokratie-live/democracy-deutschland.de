import { expect, test } from "@playwright/test";

test("donation account banner fits the first viewport on mobile", async ({ page }) => {
  await page.goto("/");
  const banner = page.locator("#donation-account-notice");
  await expect(banner.locator(".donation-account-iban")).toHaveText("DE83 2605 0001 0056 1290 91");
  await expect.poll(async () => (await banner.boundingBox())?.y).toBe(0);
  await expect(banner).toBeInViewport({ ratio: 1 });
  // No horizontal scrolling from the long IBAN.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
