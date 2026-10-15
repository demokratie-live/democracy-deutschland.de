import { expect, test } from "@playwright/test";

test("mobile menu collapses like Bootstrap 4", async ({ page }) => {
  await page.goto("/");
  const toggler = page.locator(".navbar-toggler");
  const collapse = page.locator("#navbar-collapse");
  await expect(collapse).toBeHidden();
  await expect(toggler).toHaveAttribute("aria-expanded", "false");

  await toggler.click();
  await expect(toggler).toHaveAttribute("aria-expanded", "true");
  await expect(collapse).toHaveClass(/\bshow\b/);
  await expect(collapse).toBeVisible();

  await toggler.click();
  await expect(toggler).toHaveClass(/collapsed/);
  await expect(collapse).toHaveClass(/^collapse navbar-collapse$/);
  await expect(collapse).toBeHidden();
});

test("clicking a menu item closes the menu and navigates", async ({ page }) => {
  await page.goto("/");
  await page.locator(".navbar-toggler").click();
  await expect(page.locator("#navbar-collapse")).toHaveClass(/\bshow\b/);
  await page.locator("#menu_wahlometer").click();
  await expect(page).toHaveURL(/\/wahlometer\/$/);
  await expect(page.locator("#navbar-collapse")).toBeHidden();
});

test("no scroll icon and line break before the version on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".scroll-icon-container")).toBeHidden();
  await expect(page.locator("#index-title-year-break")).toBeAttached();
});
