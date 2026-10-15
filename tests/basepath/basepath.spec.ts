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

// Browsers only load the fonts a page uses; icomoon (store badges) only on / and /wahlometer/.
const FONTS = ["helvetica", "edosz", "Font Awesome 5 Free"];
const pages = [
  { path: "/", fonts: [...FONTS, "icomoon"] },
  { path: "/wahlometer/", fonts: [...FONTS, "icomoon"] },
  { path: "/spenden/", fonts: [...FONTS, "helvetica_bold"] },
  { path: "/ueber-uns/", fonts: [...FONTS] },
  { path: "/presse/", fonts: [...FONTS] },
  { path: "/faq/", fonts: [...FONTS] },
  { path: "/kontakt/", fonts: [...FONTS] },
  { path: "/impressum/", fonts: [...FONTS] },
  { path: "/datenschutz/", fonts: [...FONTS] },
  { path: "/nutzungsbedingungen/", fonts: [...FONTS] },
  { path: "/engineering/", fonts: [...FONTS] },
  { path: "/unsubscribe/", fonts: [...FONTS] },
  { path: "/buerger/", fonts: [...FONTS] },
  { path: "/politiker/", fonts: [...FONTS] },
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
    for (const href of state.stylesheets)
      expect(href).toMatch(new RegExp(`^${BASE}/(css|vendor)/`));
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
  // Since the blog import the teasers lead to the post.
  expect((await page.request.get((await teaser.getAttribute("href"))!)).status()).toBe(200);
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

test("engineering: anchor #help below the basePath", async ({ page }) => {
  await page.goto(`${BASE}/engineering/`);
  await page.locator(".footer a", { hasText: "Mithelfen" }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/engineering/#help$`));
  await page.goto(`${BASE}/buerger/`);
  await page.locator("a.btn-democracy", { hasText: "KONTAKTFORMULAR" }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/kontakt/$`));
});

// Same build: NEXT_PUBLIC_BUGREPORT_ENDPOINT=/bugreport-endpoint and
// NEXT_PUBLIC_VOLUNTEER_ENDPOINT=/volunteer-endpoint (tests/e2e covers the mailto path).
test("bug report and volunteer forms POST the old data objects to their endpoints", async ({
  page,
}) => {
  const forms = formsSchema.parse(
    yaml.parse(fs.readFileSync(path.join(process.cwd(), "content/site/forms.yaml"), "utf-8")),
  );
  const bodies: Record<string, unknown[]> = { bugreport: [], volunteer: [] };
  let status = 200;
  for (const type of ["bugreport", "volunteer"]) {
    await page.route(`**/${type}-endpoint`, async (route) => {
      bodies[type].push(route.request().postDataJSON());
      expect(route.request().method()).toBe("POST");
      await route.fulfill({ status, contentType: "application/json", body: '{"status":true}' });
    });
  }
  const alerts: string[] = [];
  page.on("dialog", async (dialog) => {
    alerts.push(dialog.message());
    await dialog.dismiss();
  });
  page.on("request", (request) => {
    if (request.url().startsWith("mailto:")) throw new Error("mailto despite endpoint");
  });
  await page.goto(`${BASE}/engineering/`);

  // No file picker; with an endpoint the notice asks for screenshots by mail
  // to the recipient (content/pages/engineering.mdx, forms.yaml).
  await expect(page.locator('#bug-form input[type="file"]')).toHaveCount(0);
  const notice = page.locator("#bug-attachments");
  await expect(notice).toHaveText(
    `Screenshots? Einfach per E-Mail an ${forms.recipient} schicken.`,
  );
  await expect(notice.locator("a")).toHaveAttribute("href", `mailto:${forms.recipient}`);
  await expect(notice.locator("a")).toHaveText(forms.recipient);

  // Bug report: the old data object without `files`.
  const bug = {
    type: "bugreport",
    name: "Max",
    email: "max@example.org",
    title: "Absturz",
    platform: "iOS",
    version: "1.5.12",
    text: "Hallo",
  };
  for (const key of ["name", "email", "title", "platform", "version", "text"] as const) {
    await page.fill(`#bug-${key}`, bug[key]);
  }
  status = 500;
  await page.click("#bug-send");
  await expect.poll(() => alerts).toEqual([forms.messages.failed]);
  await expect(page.locator("#bug-text")).toHaveValue("Hallo");
  status = 200;
  await page.click("#bug-send");
  await expect.poll(() => alerts.length).toBe(2);
  expect(alerts[1]).toBe(forms.messages.sent);
  // Success: reset, the notice stays.
  await expect(page.locator("#bug-name")).toHaveValue("");
  await expect(notice).toBeVisible();
  expect(bodies.bugreport).toEqual([bug, bug]);

  // Volunteer: checkboxes as true or null.
  await page.fill("#vol-name", "Erika");
  await page.fill("#vol-email", "erika@example.org");
  await page.fill("#vol-text", "Ich helfe mit.");
  await page.check("#vol-backend");
  await page.check("#vol-feature");
  await page.click("#vol-send");
  await expect.poll(() => alerts.length).toBe(3);
  expect(alerts[2]).toBe(forms.messages.sent);
  await expect(page.locator("#vol-backend")).not.toBeChecked();
  expect(bodies.volunteer).toEqual([
    {
      type: "volunteer",
      name: "Erika",
      email: "erika@example.org",
      check_uiux: null,
      check_frontend: null,
      check_backend: true,
      check_kryptologe: null,
      check_marketing: null,
      check_redakteur: null,
      check_botschafter: null,
      check_feature: true,
      text: "Ich helfe mit.",
    },
  ]);
});

test("blog: theme CSS, fonts, images and links live below the basePath", async ({ page }) => {
  const missing = new Set(
    yaml.parse(
      fs.readFileSync(path.join(process.cwd(), "content/blog/missing-uploads.yaml"), "utf-8"),
    ) as string[],
  );
  for (const route of [
    "/blog/",
    "/blog/page/2/",
    "/blog/2023/02/berlin-waehlen-ist-nicht-abstimmen/",
  ]) {
    const failed = trackFailures(page);
    await page.goto(`${BASE}${route}`);
    await page.evaluate(() =>
      document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
        img.loading = "eager";
      }),
    );
    await page.waitForLoadState("networkidle");
    const state = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
        images: [...document.images].map((img) => ({ url: img.src, ok: img.naturalWidth > 0 })),
        stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) =>
          link.getAttribute("href"),
        ),
        links: [...document.querySelectorAll<HTMLAnchorElement>("a[href^='/']")].map((a) =>
          a.getAttribute("href"),
        ),
        actions: [...document.querySelectorAll("form")].map((form) => form.getAttribute("action")),
      };
    });
    expect(state.fonts).toEqual(expect.arrayContaining(["Playfair Display"]));
    for (const href of state.stylesheets) {
      expect(href).toMatch(new RegExp(`^${BASE}/blog/wp-content/themes/lovecraft/`));
    }
    for (const image of state.images) {
      const file = decodeURI(new URL(image.url).pathname).slice(BASE.length);
      expect(image.url.startsWith(`http://localhost:3101${BASE}/`), image.url).toBe(true);
      if (!missing.has(file)) expect(image.ok, image.url).toBe(true);
    }
    for (const href of state.links) expect(href).toMatch(new RegExp(`^${BASE}/`));
    for (const action of state.actions) expect(action).toBe(`${BASE}/blog/`);
    expect(
      failed.filter(
        (entry) =>
          !missing.has(decodeURI(new URL(entry.split(" ")[1]).pathname).slice(BASE.length)),
      ),
    ).toEqual([]);
  }
});

test("blog archives, search, feeds, short links and /blogseite/ below the basePath", async ({
  page,
  request,
}) => {
  const failed = trackFailures(page);
  await page.goto(`${BASE}/blog/category/newsletter/`);
  await expect(page.locator(".archive-navigation a", { hasText: "Nächster" })).toHaveAttribute(
    "href",
    `${BASE}/blog/category/newsletter/page/2/`,
  );
  await expect(page.locator('head link[title$="Kategorie-Feed für Newsletter"]')).toHaveAttribute(
    "href",
    `${BASE}/blog/category/newsletter/feed/`,
  );

  // The search loads its index below the basePath and links there.
  await page.locator(".sidebar .wp-block-search__input").fill("bundestag abstimmung");
  await page.locator(".sidebar .wp-block-search__button").click();
  await expect(page).toHaveURL(`${BASE}/blog/?s=bundestag+abstimmung`);
  await page.waitForFunction(() => document.body.classList.contains("search-results"));
  await expect(page.locator(".archive-navigation a", { hasText: "Nächster" })).toHaveAttribute(
    "href",
    `${BASE}/blog/page/2/?s=bundestag+abstimmung`,
  );
  const links = await page
    .locator("#posts a")
    .evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href")));
  for (const href of links) expect(href).toMatch(new RegExp(`^${BASE}/blog/`));
  // Lazy result images load when scrolled to: load them all, then check.
  const broken = await page.evaluate(async () => {
    const images = [...document.querySelectorAll<HTMLImageElement>("#posts img")];
    for (const img of images) img.loading = "eager";
    await Promise.all(
      images
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
        ),
    );
    return images.filter((img) => !img.naturalWidth).map((img) => img.src);
  });
  expect(broken).toEqual([]);

  await page.goto(`${BASE}/blog/?p=952`);
  await expect(page).toHaveURL(`${BASE}/blog/2026/06/spendenkonto-zieht-um/`);

  // Feeds keep absolute links on the live domain.
  const feed = await request.get(`${BASE}/blog/feed/`);
  expect(feed.status()).toBe(200);
  const xml = await feed.text();
  expect(xml).toContain(
    "<link>https://democracy-deutschland.de/blog/2026/06/spendenkonto-zieht-um/</link>",
  );
  // No path below the basePath: those exist only on the test host.
  expect(xml).not.toMatch(/(?:href|src)="\/democracy-deutschland\.de\//);

  await page.goto(`${BASE}/blogseite/`);
  await expect(page.locator("#blogiframe")).toHaveAttribute("src", `${BASE}/blog/`);
  // The height is measured on load like live; under load the body can round to
  // 1 px less after the blog hydrates, so allow 1 px.
  await expect
    .poll(() =>
      page.locator("#blogiframe").evaluate((iframe: HTMLIFrameElement) => {
        const body = iframe.contentDocument?.body;
        const height = parseInt(iframe.getAttribute("height") ?? "", 10);
        return body ? Math.abs(height - body.scrollHeight) <= 1 : false;
      }),
    )
    .toBe(true);
  expect(failed).toEqual([]);
});
