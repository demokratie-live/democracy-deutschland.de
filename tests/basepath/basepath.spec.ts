import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import yaml from "yaml";
import { formsSchema } from "../../src/lib/schemas/site";

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
  { path: "/presse/", fonts: [...FONTS] },
  { path: "/faq/", fonts: [...FONTS] },
  { path: "/kontakt/", fonts: [...FONTS] },
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

test("press downloads, media and blog images live below the basePath", async ({ page }) => {
  await page.goto(`${BASE}/presse/`);
  const logo = page.locator('a[href$="/files/download/DEMOCRACY-Logo.png"]');
  await expect(logo).toHaveAttribute("href", `${BASE}/files/download/DEMOCRACY-Logo.png`);
  expect((await page.request.get((await logo.getAttribute("href"))!)).status()).toBe(200);
  const blogImage = page.locator('img[src*="/blog/wp-content/uploads/"]').first();
  await expect(blogImage).toHaveAttribute("src", new RegExp(`^${BASE}/blog/wp-content/uploads/`));
  const teaser = page.locator('a[href*="/blog/20"]').first();
  await expect(teaser).toHaveAttribute("href", new RegExp(`^${BASE}/blog/\\d{4}/\\d{2}/`));
});

test("FAQ menu keeps the page below the basePath", async ({ page }) => {
  await page.goto(`${BASE}/faq/`);
  const finanzen = page.locator(".faq-menu", { hasText: "FINANZEN" });
  await expect(finanzen).toHaveAttribute("href", `${BASE}/faq/`);
  await finanzen.click();
  await expect(page.locator(".faq-menu.active")).toHaveText("FINANZEN");
  await expect(page).toHaveURL(new RegExp(`${BASE}/faq/$`));
  await expect(page.locator("#content .col-12 > h5 a")).toHaveAttribute("href", `${BASE}/kontakt/`);
});

// This build also sets NEXT_PUBLIC_CONTACT_ENDPOINT=/contact-endpoint (package.json,
// test:basepath), so the endpoint path of the contact form is tested here; the
// default build (tests/e2e/contact.spec.ts) covers the mailto path.
test("contact form POSTs to NEXT_PUBLIC_CONTACT_ENDPOINT and shows the old alerts", async ({
  page,
}) => {
  const forms = formsSchema.parse(
    yaml.parse(fs.readFileSync(path.join(process.cwd(), "content/site/forms.yaml"), "utf-8")),
  );
  const bodies: unknown[] = [];
  let status = 200;
  await page.route("**/contact-endpoint", async (route) => {
    bodies.push(route.request().postDataJSON());
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["content-type"]).toBe("application/json");
    await route.fulfill({ status, contentType: "application/json", body: '{"status":true}' });
  });
  const alerts: string[] = [];
  page.on("dialog", async (dialog) => {
    alerts.push(dialog.message());
    await dialog.dismiss();
  });
  page.on("request", (request) => {
    if (request.url().startsWith("mailto:")) throw new Error("mailto despite endpoint");
  });

  await page.goto(`${BASE}/kontakt/`);
  const data = {
    type: "contact",
    vorname: "Max",
    nachname: "Mustermann",
    email: "max@example.org",
    text: "Hallo",
  };
  const fill = async () => {
    for (const id of ["vorname", "nachname", "email", "text"] as const) {
      await page.fill(`#${id}`, data[id]);
    }
  };

  // Server error: the old error alert, the form keeps its content.
  status = 500;
  await fill();
  await page.click("#send_contact");
  await expect.poll(() => alerts).toEqual([forms.messages.failed]);
  await expect(page.locator("#text")).toHaveValue("Hallo");

  // Success: reset, then the old success alert.
  status = 200;
  await page.click("#send_contact");
  await expect.poll(() => alerts).toEqual([forms.messages.failed, forms.messages.sent]);
  for (const id of ["vorname", "nachname", "email", "text"]) {
    await expect(page.locator(`#${id}`)).toHaveValue("");
  }
  expect(bodies).toEqual([data, data]);
});
