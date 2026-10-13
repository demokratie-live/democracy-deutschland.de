import { expect, test } from "@playwright/test";

test("mobile: the blog frame takes the height of the mobile blog", async ({ page }) => {
  await page.goto("/blogseite/");
  const frame = page.locator("#blogiframe");
  await expect
    .poll(() =>
      frame.evaluate((iframe: HTMLIFrameElement) => {
        const body = iframe.contentDocument?.body;
        return body ? iframe.getAttribute("height") === `${body.scrollHeight}px` : false;
      }),
    )
    .toBe(true);
  // The blog inside shows its mobile toggles.
  await expect(page.frameLocator("#blogiframe").locator(".search-toggle")).toBeVisible();
});
