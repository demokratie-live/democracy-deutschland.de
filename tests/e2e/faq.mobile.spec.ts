import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/faq/");
});

test("menu sits above the questions; tapping filters and toggles", async ({ page }) => {
  const menu = await page.locator(".faq-menu-container").boundingBox();
  const first = await page.locator(".panel-faq").first().boundingBox();
  expect(menu!.y + menu!.height).toBeLessThanOrEqual(first!.y);

  await page.locator(".faq-menu", { hasText: "FINANZEN" }).tap();
  await expect(page.locator(".faq-menu.active")).toHaveText("FINANZEN");
  const visible = page.locator(".panel-faq:visible");
  await expect(visible.first()).toHaveClass(/finanzen/);
  await expect(visible.first().locator(".panel-collapse")).toHaveClass(/\bshow\b/);

  await visible.nth(1).locator(".faq_header").tap();
  await expect(visible.nth(1).locator(".panel-collapse")).toHaveClass(/\bshow\b/);
  await expect(page).toHaveURL(/\/faq\/$/);
});
