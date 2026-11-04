import { expect, test } from "@playwright/test";
import { contentYaml, expectVideoStartsOnClick, waitForScrollEnd } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // The donation account banner slides in after load and pushes the page down;
  // wait until it is open, so positions measured by the tests stay put.
  await expect
    .poll(async () => (await page.locator("#donation-account-notice").boundingBox())?.y)
    .toBe(0);
});

test("texts from MDX", async ({ page }) => {
  await expect(page.locator(".header-home #index-title")).toHaveText("DEMOCRACY");
  await expect(page.locator(".header-home p#index-title-year")).toHaveText(["1", "5"]);
  await expect(page.locator("#video-box")).toContainText("Worum geht es bei DEMOCRACY (2:30)?");
  await expect(page.locator(".info-badge")).toHaveCount(5);
  await expect(page.locator(".info-badge b")).toHaveText([
    "Wähle",
    "Informiere",
    "Stimme",
    "Vergleiche",
    "Analysiere",
  ]);
  await expect(page.locator(".ri-title-heading")).toHaveText(["Für Bürger,", "Für Politiker,"]);
  await expect(page.locator("#press-logos a")).toHaveCount(4);
});

test("app links come from app-links.yaml", async ({ page }) => {
  const links = contentYaml<Record<string, string>>("site/app-links.yaml");
  const header = page.locator(".header-home");
  await expect(header.locator(".icon-app-store-outline")).toHaveAttribute("href", links.appStore);
  await expect(header.locator(".icon-google-play-outline")).toHaveAttribute(
    "href",
    links.playStore,
  );
  await expect(header.getByText("zur Browserversion")).toHaveAttribute(
    "href",
    links.browserVersion,
  );
  await expect(header.locator('a[title="Android App Bundle"]')).toHaveAttribute("href", links.aab);
  await expect(header.locator('a[title="Android Package"]')).toHaveAttribute("href", links.apk);
  expect(links.apk).toContain("democracy-client/releases/latest/download/");
  expect(links.aab).toContain("democracy-client/releases/latest/download/");
});

test("store badges toggle the filled icon on hover", async ({ page }) => {
  const badge = page.locator(".header-home .badge-link").first();
  await expect(badge).not.toHaveClass(/icon-app-store-filled/);
  await badge.hover();
  await expect(badge).toHaveClass(/icon-app-store-filled/);
  await page.mouse.move(0, 0);
  await expect(badge).not.toHaveClass(/icon-app-store-filled/);
});

test("info badges switch active state, icons and video", async ({ page }) => {
  const badges = page.locator(".info-badge");
  await expect(badges.nth(0)).toHaveClass(/active/);
  await expect(page.locator("#video-mp4")).toHaveAttribute("src", "/videos/DDW-List_croped.mp4");

  // Scroll first so the navbar height (class "scrolled") is final, like for a
  // user who scrolled down to the badges.
  await badges.nth(2).scrollIntoViewIfNeeded();
  await expect(page.locator("nav.navbar")).toHaveClass(/scrolled/);
  await badges.nth(2).click();
  await expect(badges.nth(2)).toHaveClass(/active/);
  await expect(page.locator(".info-badge.active")).toHaveCount(1);
  await expect(page.locator("#video-mp4")).toHaveAttribute("src", "/videos/DDW-vote_croped.mp4");
  await expect(badges.nth(2).locator(".info-icon-active")).toBeVisible();
  await expect(badges.nth(2).locator(".info-icon-passive")).toBeHidden();
  await expect(badges.nth(0).locator(".info-icon-passive")).toBeVisible();
  await expect(badges.nth(0).locator(".info-icon-active")).toBeHidden();

  // init_home(): scroll to #device-explain minus navbar height minus 50 px.
  const y = await waitForScrollEnd(page);
  const expected = await page.evaluate(() => {
    const target = document.getElementById("device-explain")!;
    const navbar = document.querySelector(".navbar")!;
    const style = getComputedStyle(navbar);
    const height =
      navbar.getBoundingClientRect().height -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom) -
      parseFloat(style.borderTopWidth) -
      parseFloat(style.borderBottomWidth);
    return Math.round(target.getBoundingClientRect().top + window.scrollY - height - 50);
  });
  expect(Math.abs(y - expected)).toBeLessThanOrEqual(1);
});

test("scroll icon scrolls to the first #about", async ({ page }) => {
  await page.locator(".scroll-icon").click();
  const y = await waitForScrollEnd(page);
  const about = await page.evaluate(
    () => document.getElementById("about")!.getBoundingClientRect().top + window.scrollY,
  );
  expect(Math.abs(y - about)).toBeLessThanOrEqual(1);
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

test("YouTube thumbnail starts the video on click", async ({ page }) => {
  await expectVideoStartsOnClick(
    page,
    page.locator(".yt-hd-thumbnail-inner-container"),
    "DFXcnRdXA7k",
  );
});

test("donation account banner slides in at the top and can be closed", async ({ page }) => {
  const banner = page.locator("#donation-account-notice");
  await expect(banner).toBeVisible();
  await expect(banner.locator(".donation-account-iban")).toHaveText("DE83 2605 0001 0056 1290 91");
  await expect(banner).toContainText("NOLADE21GOE");
  await expect(banner.getByRole("link", { name: "Mehr dazu im Blog" })).toHaveAttribute(
    "href",
    /\/blog\/2026\/06\/spendenkonto-zieht-um\/$/,
  );
  await expect(banner.getByRole("link", { name: "Zur Spendenseite" })).toHaveAttribute(
    "href",
    /\/spenden\/$/,
  );
  const navbar = page.locator(".navbar");
  for (const size of [
    { width: 1280, height: 800 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(size);
    // Fully slid in at the top; the navbar sits right below it.
    await expect.poll(async () => (await banner.boundingBox())?.y).toBe(0);
    const height = (await banner.boundingBox())!.height;
    await expect.poll(async () => (await navbar.boundingBox())?.y).toBeCloseTo(height, 0);
    await expect(banner).toBeInViewport({ ratio: 1 });
  }

  // Scrolls away with the page, the navbar stays at the top.
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(async () => (await navbar.boundingBox())?.y).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));

  await banner.getByRole("button", { name: "Hinweis schließen" }).click();
  await expect(banner).toBeHidden();
  await expect.poll(async () => (await navbar.boundingBox())?.y).toBe(0);
  expect(await page.evaluate(() => document.body.style.paddingTop)).toBe("");

  // Closed stays closed.
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(banner).toBeHidden();
});

test("donation account banner keeps the reading position of a visitor who scrolled", async ({
  page,
}) => {
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, 600));
  const before = await page.locator("#about").first().boundingBox();
  // Fully open: the page is pushed down by the whole banner height.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          parseFloat(document.body.style.paddingTop) ===
          document.getElementById("donation-account-notice")!.offsetHeight,
      ),
    )
    .toBe(true);
  const after = await page.locator("#about").first().boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});
