import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/blog/");
});

test("mobile: toggles instead of the sidebar", async ({ page }) => {
  const errors = trackErrors(page);
  // .toggles itself has no height: the buttons are positioned absolutely.
  await expect(page.locator(".nav-toggle")).toBeVisible();
  await expect(page.locator(".search-toggle")).toBeVisible();
  await expect(page.locator("aside.sidebar")).toBeHidden();
  await expect(page.locator(".mobile-search")).toBeHidden();
  expect(errors).toEqual([]);
});

test("search toggle slides the mobile search down and up (global.js)", async ({ page }) => {
  const toggle = page.locator(".search-toggle");
  const search = page.locator(".mobile-search");
  await toggle.click();
  await expect(toggle).toHaveClass("search-toggle toggle active");
  // jQuery slideDown: height runs up while overflow is hidden, then only display stays.
  await expect(search).toHaveCSS("overflow", "hidden");
  await expect(search).toHaveAttribute("style", "display: block;");
  await expect(page.locator(".mobile-search .search-field")).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveClass("search-toggle toggle");
  await expect(search).toHaveAttribute("style", "display: none;");
  await expect(search).toBeHidden();
});

test("nav toggle closes the open search and toggles the (empty) menu", async ({ page }) => {
  await page.locator(".search-toggle").tap();
  await expect(page.locator(".mobile-search")).toHaveAttribute("style", "display: block;");
  await page.locator(".nav-toggle").tap();
  await expect(page.locator(".nav-toggle")).toHaveClass("nav-toggle toggle active");
  await expect(page.locator(".search-toggle")).toHaveClass("search-toggle toggle");
  await expect(page.locator(".mobile-search")).toHaveAttribute("style", "display: none;");
  await expect(page.locator(".mobile-menu")).toHaveAttribute("style", "display: block;");
  await page.locator(".nav-toggle").tap();
  await expect(page.locator(".nav-toggle")).toHaveClass("nav-toggle toggle");
  await expect(page.locator(".mobile-menu")).toHaveAttribute("style", "display: none;");
});

test("wider than 1000 px both toggles reset", async ({ page }) => {
  await page.locator(".search-toggle").tap();
  await expect(page.locator(".mobile-search")).toHaveAttribute("style", "display: block;");
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(page.locator(".search-toggle")).toHaveClass("search-toggle toggle");
  await expect(page.locator(".mobile-search")).toHaveAttribute("style", "display: none;");
  await expect(page.locator("aside.sidebar")).toBeVisible();
});

test("the header search submits to the client search", async ({ page }) => {
  const errors = trackErrors(page);
  await page.locator(".search-toggle").tap();
  await page.locator(".mobile-search .search-field").fill("weihnachten");
  await page.locator(".mobile-search .search-field").press("Enter");
  await expect(page).toHaveURL("/blog/?s=weihnachten");
  await page.waitForFunction(() => document.body.classList.contains("search-results"));
  await expect(page.locator(".archive-title")).toHaveText("Suchergebnisse: „weihnachten“");
  await expect(page.locator("#posts > .post").first()).toBeVisible();
  // The toggles keep working on the results page.
  await page.locator(".search-toggle").tap();
  await expect(page.locator(".mobile-search")).toHaveAttribute("style", "display: block;");
  expect(errors).toEqual([]);
});
