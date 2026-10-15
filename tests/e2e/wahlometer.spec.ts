import { expect, test } from "@playwright/test";
import { expectVideoStartsOnClick, waitForScrollEnd } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/wahlometer/");
});

test("texts from MDX", async ({ page }) => {
  await expect(page.locator(".header-wom #index-title")).toHaveText("Wahl-O-Meter");
  await expect(page.locator(".si-container")).toHaveCount(3);
  await expect(page.locator(".si-subtitle-heading")).toHaveText([
    "faktenbasierter Wahlhelfer",
    "schnell & individuell",
    "kostenlos & gemeinnützig",
  ]);
  await expect(page.locator("#video-box")).toContainText(
    "Wie funktioniert der Wahl-O-Meter (1:00)?",
  );
  await expect(page.locator("#wom-campaign-container h1").first()).toHaveText(
    "Finde die Partei, die Dich wirklich vertritt",
  );
  await expect(page.locator("#wom-campaign-badges .badge-link")).toHaveCount(2);
});

test("YouTube thumbnail starts the video on click", async ({ page }) => {
  await expectVideoStartsOnClick(
    page,
    page.locator(".yt-hd-thumbnail-inner-container"),
    "uWwQquy_MD0",
  );
});

test("comparison accordion opens the clicked row", async ({ page }) => {
  const rows = page.locator(".containerrow-acc");
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0).locator(".container-text-acc")).toBeVisible();
  await expect(rows.nth(0).locator(".ri-title-heading-acc")).toHaveText([
    "Wahl-O-Mat",
    "Wahl-O-Meter",
  ]);
  await expect(rows.nth(2).locator(".container-text-acc")).toBeHidden();

  await rows.nth(2).locator(".ri-subtitle-right").click();
  await expect(rows.nth(2).locator(".container-text-acc")).toBeVisible();
  await expect(rows.nth(2).locator(".container-text-acc")).toHaveCSS("display", "inline-flex");
  await expect(rows.nth(0).locator(".container-text-acc")).toBeHidden();
  await expect(rows.nth(2).locator(".rectanglebox-acc")).toHaveClass(/content-open/);
  await expect(rows.nth(0).locator(".ri-title-heading-acc")).toHaveCount(0);
  await expect(rows.nth(2).locator(".haken").first()).toBeHidden();
  await expect(rows.nth(0).locator(".haken").first()).toBeVisible();
});

test("store badges of the campaign block toggle on hover", async ({ page }) => {
  const badge = page.locator("#icon-google-play-outline-wom");
  await badge.hover();
  await expect(badge).toHaveClass(/icon-google-play-filled/);
});

test("download link scrolls to the campaign block on the same page", async ({ page }) => {
  await page.getByText("DEMOCRACY App herunterladen").click();
  await expect(page).toHaveURL(/\/wahlometer\/#wom-campaign-container$/);
  const y = await waitForScrollEnd(page);
  const target = await page.evaluate(
    () =>
      document.getElementById("wom-campaign-container")!.getBoundingClientRect().top +
      window.scrollY,
  );
  expect(Math.abs(y - target)).toBeLessThanOrEqual(1);
});

test("scroll icon stays on the Wahl-O-Meter (live bug fixed)", async ({ page }) => {
  await page.locator(".scroll-icon").click();
  await waitForScrollEnd(page);
  await expect(page).toHaveURL(/\/wahlometer\/$/);
  await expect(page.locator(".header-wom")).toHaveCount(1);
});
