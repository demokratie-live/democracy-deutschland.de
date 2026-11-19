import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { trackErrors } from "./helpers";

/**
 * `fixture`: the text is still word for word the old live text (saved 2026-10-13).
 * Datenschutz and Nutzungsbedingungen were rewritten in November 2026 (TASK-87; board approval
 * and legal review pending before merge); for them the Markdown is the source, so the tests check that it renders
 * completely instead of comparing with the old live state.
 */
const PAGES = [
  { state: "impressum", path: "/impressum/", heading: "h1", title: "Impressum", fixture: true },
  {
    state: "datenschutz",
    path: "/datenschutz/",
    heading: "h1",
    title: "Datenschutzerklärung",
    fixture: false,
  },
  {
    state: "nutzungsbedingungen",
    path: "/nutzungsbedingungen/",
    heading: "h1",
    title: "Nutzungsbedingungen",
    fixture: false,
  },
];

/** Headings of a legal Markdown file (ATX `#`–`###`), without emphasis markers. */
function markdownHeadings(state: string) {
  const source = fs.readFileSync(path.join(process.cwd(), `content/legal/${state}.md`), "utf-8");
  return [...source.matchAll(/^#{1,3} (.+)$/gm)].map((m) => m[1].replace(/\*\*/g, "").trim());
}

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

for (const { state, path: route, heading, title, fixture } of PAGES) {
  test(`${route}: renders every section of the Markdown source`, async ({ page }) => {
    test.skip(fixture, "compared word for word with the live text below");
    await page.goto(route);
    const rendered = await page
      .locator("#content .main-container")
      .locator("h1, h2, h3")
      .allTextContents();
    const expected = markdownHeadings(state);
    expect(expected.length).toBeGreaterThan(10);
    expect(rendered.map((h) => h.trim())).toEqual(expected);
  });

  test(`${route}: text is word for word the saved live text`, async ({ page }) => {
    test.skip(!fixture, "rewritten text, the Markdown is the source");
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

test("links of the legal texts", async ({ page }) => {
  await page.goto("/impressum/");
  await expect(
    page.locator('#content a[href="mailto:contact@democracy-deutschland.de"]'),
  ).toHaveText("contact@democracy-deutschland.de");

  for (const route of ["/datenschutz/", "/nutzungsbedingungen/"]) {
    await page.goto(route);
    // Rewritten texts link to each other with the new paths and name the contact address.
    const other = route === "/datenschutz/" ? "/nutzungsbedingungen/" : "/datenschutz/";
    await expect(page.locator(`#content a[href="${other}"]`).first()).toBeVisible();
    await expect(
      page.locator('#content a[href="mailto:contact@democracy-deutschland.de"]').first(),
    ).toBeVisible();
    // No links into the old hash router and none to the EU ODR platform (shut down 2025-07-20).
    await expect(page.locator('#content a[href*="#!"]')).toHaveCount(0);
    await expect(page.locator('#content a[href*="ec.europa.eu/consumers/odr"]')).toHaveCount(0);
  }
});

test("FAQ link to the privacy policy works", async ({ page }) => {
  // The first question is open on load and links "hier" to /datenschutz/.
  await page.goto("/faq/");
  await page.locator('#content .panel-body a[href="/datenschutz/"]').first().click();
  await expect(page).toHaveURL(/\/datenschutz\/$/);
  await expect(page.locator("#content h1")).toHaveText("Datenschutzerklärung");
});
