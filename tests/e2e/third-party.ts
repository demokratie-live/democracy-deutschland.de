import fs from "fs";
import path from "path";
import { expect, test } from "@playwright/test";

/**
 * "No request to a foreign host on page load" for every HTML page of the
 * export (website, blog, 404) plus the client-rendered blog search, run by
 * third-party.spec.ts (desktop) and third-party.mobile.spec.ts (mobile).
 * Third parties (YouTube, Discord) may only load after a click.
 *
 * The pages come from out/ (build first). SITE_URL runs the same pages
 * against a deployed host instead of the local server, e.g.
 * `SITE_URL=https://test.democracy-deutschland.de pnpm exec playwright test third-party`.
 */
const OUT = path.join(process.cwd(), "out");

function exportedPages(dir = OUT): string[] {
  const pages: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "_next") pages.push(...exportedPages(file));
    } else if (entry.name.endsWith(".html")) {
      // Feeds are folders named index.html with an XML file inside.
      const head = fs.readFileSync(file, "utf-8").slice(0, 100).toLowerCase();
      if (!head.startsWith("<!doctype html")) continue;
      const rel = path.relative(OUT, file).split(path.sep).join("/");
      pages.push("/" + rel.replace(/(^|\/)index\.html$/, "$1"));
    }
  }
  return pages;
}

const EXTRA_PAGES = ["/blog/?s=demokratie", "/blog/?s=keintrefferxyz", "/gibt-es-nicht/"];

export function thirdPartyTests() {
  const pages = [...exportedPages().sort(), ...EXTRA_PAGES];

  test("the export has pages", () => {
    expect(pages.length).toBeGreaterThan(100);
  });

  for (const page of pages) {
    test(`no third-party request: ${page}`, async ({ page: browserPage, baseURL }) => {
      const site = process.env.SITE_URL ?? baseURL!;
      const origin = new URL(site).origin;
      const foreign: string[] = [];
      browserPage.on("request", (request) => {
        const url = new URL(request.url());
        if (!url.protocol.startsWith("http")) return;
        if (url.origin !== origin) foreign.push(request.url());
      });

      await browserPage.goto(new URL(page, site).href);
      await browserPage.waitForLoadState("networkidle");
      // Lazy images and iframes only load near the viewport: load them all.
      const lazy = await browserPage.evaluate(() => {
        const elements = [...document.querySelectorAll('[loading="lazy"]')];
        for (const element of elements) element.setAttribute("loading", "eager");
        return elements.length;
      });
      if (lazy > 0) {
        await browserPage.waitForFunction(() => [...document.images].every((img) => img.complete));
      }

      expect(foreign).toEqual([]);
    });
  }
}
