import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { trackErrors } from "./helpers";

const PAGES = [
  { state: "impressum", path: "/impressum/", heading: "h1", title: "Impressum" },
  {
    state: "datenschutz",
    path: "/datenschutz/",
    heading: "h1",
    title: "DEMOCRACY App – Datenschutzerklärung",
  },
  {
    state: "nutzungsbedingungen",
    path: "/nutzungsbedingungen/",
    heading: "h2",
    title: "Nutzungsbedingungen",
  },
];

/**
 * Words of the legal text as a reader sees them: text nodes in document
 * order, <br> and block boundaries as whitespace, whitespace runs collapsed.
 * Characters stay as they are (no-break spaces, combining diacritics,
 * typographic quotes), so every changed, added or missing word shows up.
 */
async function words(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector("#content .main-container")!;
    const parts: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent!);
        return;
      }
      if (!(node instanceof Element)) return;
      const inline = ["a", "strong", "span", "em", "b", "i"].includes(node.localName);
      if (!inline) parts.push(" ");
      node.childNodes.forEach(walk);
      if (!inline) parts.push(" ");
    };
    walk(container);
    return parts
      .join("")
      .replace(/[ \t\n\r]+/g, " ")
      .trim();
  });
}

/** Link targets of the legal text as written in the markup, in document order. */
async function hrefs(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#content .main-container a")].map((a) => a.getAttribute("href")),
  );
}

for (const { state, path: route, heading, title } of PAGES) {
  test(`${route}: text is word for word the saved live text`, async ({ page }) => {
    // ?_escaped_fragment_=<state> of 2026-10-13, byte for byte.
    const live = fs.readFileSync(
      path.join(process.cwd(), `tests/fixtures/${state}.live.html`),
      "utf-8",
    );
    await page.route("**/*", (r) => r.abort()); // the fixture must not load anything
    await page.setContent(live, { waitUntil: "domcontentloaded" });
    const expected = await words(page);
    const expectedHrefs = await hrefs(page);
    await page.unroute("**/*");

    await page.goto(route);
    const actual = await words(page);
    expect(expected.length).toBeGreaterThan(1000);
    expect(actual).toBe(expected);
    // Same link targets as live, even where live links nowhere (TASK-87).
    expect(await hrefs(page)).toEqual(expectedHrefs);
  });

  test(`${route}: loads without errors, navbar marks nothing (like init_${state})`, async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
    await expect(page.locator(".nav-item.active")).toHaveCount(0);
    await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
    const container = page.locator("#content > .background-white > .container.main-container");
    await expect(container).toHaveCSS("text-align", "left");
    await expect(container.locator(`> ${heading}`).first()).toHaveText(title);
  });

  test(`${route}: legacy link #!${state} and the footer link lead here`, async ({ page }) => {
    await page.goto(`/#!${state}`);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await page.goto("/");
    const label = { impressum: "Impressum", datenschutz: "Datenschutz" }[state] ?? "Nutzungs";
    await page.locator(".footer-rechtliches a", { hasText: label }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.locator("#content .main-container")).toContainText(title);
  });
}

test("Nutzungsbedingungen: lettered lists (a, b, c) like the editor markup", async ({ page }) => {
  await page.goto("/nutzungsbedingungen/");
  const lists = page.locator("#content ol");
  await expect(lists).toHaveCount(8);
  for (const list of await lists.all()) {
    await expect(list).toHaveCSS("list-style-type", "lower-alpha");
  }
});

test("links of the legal texts", async ({ page }) => {
  await page.goto("/impressum/");
  await expect(
    page.locator('#content a[href="mailto:contact@democracy-deutschland.de"]'),
  ).toHaveText("contact@democracy-deutschland.de");

  await page.goto("/datenschutz/");
  // Like live: href="#!datenschutz" (same page, the click does nothing).
  const own = page.locator("#content a", {
    hasText: "https://www.democracy-deutschland.de/#!datenschutz",
  });
  await expect(own).toHaveAttribute("href", "#!datenschutz");
  // Live the click changes nothing; here it must not reload or scroll either.
  await own.scrollIntoViewIfNeeded();
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  const scrollY = await page.evaluate(() => window.scrollY);
  await own.click();
  await expect(page).toHaveURL(/\/datenschutz\/$/);
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await expect(page.locator("#content a", { hasText: /^Link$/ })).toHaveAttribute(
    "href",
    "http://tools.google.com/dlpage/gaoptout?hl=de",
  );

  await page.goto("/nutzungsbedingungen/");
  // Like live: the misspelled state #!nutzungsbedinungen (lands on the start page).
  await expect(
    page.locator("#content a", { hasText: "democracy-deutschland.de/#!nutzungsbedinungen" }),
  ).toHaveAttribute("href", "http://democracy-deutschland.de/#!nutzungsbedinungen");
  await expect(
    page.locator("#content a", { hasText: "http://ec.europa.eu/consumers/odr" }),
  ).toHaveAttribute("target", "_blank");
});

test("FAQ link to the privacy policy works", async ({ page }) => {
  // The first question is open on load and links "hier" to /datenschutz/.
  await page.goto("/faq/");
  await page.locator('#content .panel-body a[href="/datenschutz/"]').first().click();
  await expect(page).toHaveURL(/\/datenschutz\/$/);
  await expect(page.locator("#content h1")).toHaveText("DEMOCRACY App – Datenschutzerklärung");
});
