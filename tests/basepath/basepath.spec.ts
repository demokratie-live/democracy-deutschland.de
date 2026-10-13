import { expect, test, type Page } from "@playwright/test";

const BASE = "/democracy-deutschland.de";

/** Same-origin responses with an error status. */
function trackFailures(page: Page) {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith("http://localhost") && response.status() >= 400) {
      failed.push(`${response.status()} ${response.url()}`);
    }
  });
  return failed;
}

// Browsers only load the fonts a page uses; icomoon (icons) is not used on /spenden/.
const FONTS = ["helvetica", "edosz", "Font Awesome 5 Free"];
const pages = [
  { path: "/", fonts: [...FONTS, "icomoon"] },
  { path: "/wahlometer/", fonts: [...FONTS, "icomoon"] },
  { path: "/spenden/", fonts: [...FONTS, "helvetica_bold"] },
  { path: "/ueber-uns/", fonts: [...FONTS] },
];

for (const { path, fonts } of pages) {
  test(`${path}: CSS, fonts, images, icons and videos load below the basePath`, async ({
    page,
  }) => {
    const failed = trackFailures(page);
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    const state = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
        brokenImages: [...document.images]
          .filter((img) => img.src.startsWith(location.origin) && img.naturalWidth === 0)
          .map((img) => img.src),
        stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')]
          .map((link) => link.getAttribute("href"))
          .filter((href) => href?.startsWith("/")),
      };
    });
    expect(state.fonts).toEqual(expect.arrayContaining(fonts));
    expect(state.brokenImages).toEqual([]);
    for (const href of state.stylesheets) expect(href).toMatch(new RegExp(`^${BASE}/css/`));
    await expect(page.locator("nav.navbar")).toHaveCSS("position", "fixed");
    await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute(
      "href",
      `${BASE}/manifest.json`,
    );
    expect(failed).toEqual([]);
  });
}

test("video of the info badges loads below the basePath", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.locator("#video-mp4")).toHaveAttribute(
    "src",
    `${BASE}/videos/DDW-List_croped.mp4`,
  );
  const response = await page.request.get(`${BASE}/videos/DDW-List_croped.mp4`);
  expect(response.status()).toBe(200);
});

test("navigation keeps the basePath", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.locator("#menu_wahlometer").click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/wahlometer/$`));
  // next/link writes the basePath root without trailing slash.
  await page.locator(".navbar-brand").click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/?$`));
  await expect(page.locator(".header-home")).toBeVisible();
});

test("legacy links forward below the basePath", async ({ page }) => {
  await page.goto(`${BASE}/#!wahlometer`);
  await expect(page).toHaveURL(new RegExp(`${BASE}/wahlometer/$`));
  await page.goto(`${BASE}/democracy/`);
  await expect(page).toHaveURL(new RegExp(`${BASE}/$`));
  await page.goto(`${BASE}/#!engineering#help`);
  await expect(page).toHaveURL(new RegExp(`${BASE}/engineering/#help$`));
});

test("donation downloads and the app JSON live below the basePath", async ({ page }) => {
  await page.goto(`${BASE}/spenden/`);
  const satzung = page.getByRole("link", { name: "Satzung" });
  await expect(satzung).toHaveAttribute("href", `${BASE}/files/download/Satzung_DEMOCRACY.pdf`);
  expect((await page.request.get((await satzung.getAttribute("href"))!)).status()).toBe(200);
  const json = await page.request.get(`${BASE}/api.php?call=donation_status`);
  expect(json.status()).toBe(200);
  expect((await json.json()).status).toBe(true);
});
