import { expect, test } from "@playwright/test";

test("donation account notice is in the first viewport on mobile", async ({ page }) => {
  await page.goto("/");
  const notice = page.locator(".header-home #donation-account-notice");
  await expect(notice.locator(".donation-account-iban")).toHaveText("DE83 2605 0001 0056 1290 91");
  await expect(notice).toBeInViewport({ ratio: 1 });
  // No horizontal scrolling from the long IBAN.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
