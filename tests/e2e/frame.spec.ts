import { expect, test } from "@playwright/test";
import { contentYaml, waitForScrollEnd } from "./helpers";

interface Head {
  title: string;
  meta: Record<string, string>;
  openGraph: Record<string, string>;
  icons: Array<{ rel: string; href: string; sizes?: string }>;
  manifest: string;
}

test.describe("navbar", () => {
  test("start page: class startpage and active item", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav.navbar");
    await expect(nav).toHaveClass(/startpage/);
    await expect(page.locator(".nav-item.active")).toHaveCount(1);
    await expect(page.locator(".nav-item.active > a")).toHaveAttribute("id", "menu_home");
    await expect(page.locator(".navbar-brand")).toHaveAttribute("href", "/");
    await expect(page.locator("#menu_donate")).toHaveClass(/menu-important/);
  });

  test("Wahl-O-Meter: active item follows client navigation", async ({ page }) => {
    await page.goto("/");
    await page.locator("#menu_wahlometer").click();
    await expect(page).toHaveURL(/\/wahlometer\/$/);
    await expect(page.locator(".nav-item.active > a")).toHaveAttribute("id", "menu_wahlometer");
    await expect(page.locator("nav.navbar")).toHaveClass(/startpage/);
  });

  test("class scrolled while the page is scrolled", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav.navbar");
    await expect(nav).not.toHaveClass(/scrolled/);
    await page.mouse.wheel(0, 400);
    await expect(nav).toHaveClass(/scrolled/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(nav).not.toHaveClass(/scrolled/);
  });
});

test.describe("footer", () => {
  test("links, newsletter, social media and copyright", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator(".footer");
    const newsletter = footer.locator(".btn-democracy");
    await expect(newsletter).toHaveAttribute(
      "href",
      "https://listmonk.democracy-app.de/subscription/form",
    );
    await expect(newsletter).toHaveAttribute("target", "_blank");
    await expect(newsletter).toHaveText("NEWSLETTER ABONNIEREN");

    const legal = footer.locator(".footer-rechtliches a");
    await expect(legal).toHaveText(["Nutzungsbedingungen", "Datenschutz", "Impressum", "Kontakt"]);
    await expect(legal.first()).toHaveAttribute("href", "/nutzungsbedingungen/");

    const touch = footer.locator(".footer-in-touch a");
    await expect(touch).toHaveText(["Programmieren", "Mithelfen", "Blog", "FAQ"]);
    await expect(touch.nth(1)).toHaveAttribute("href", "/engineering/#help");
    await expect(touch.nth(2)).toHaveAttribute("href", "/blogseite/");

    const social = footer.locator("#sm a");
    await expect(social).toHaveCount(8);
    await expect(footer.locator("#sm .fa-instagram")).toHaveCount(1);
    await expect(footer.locator("#sm .fa-telegram")).toHaveCount(1);
    await expect(page.locator(".copyright")).toHaveText(
      "BY NC ND 4.0 — 2025 DEMOCRACY Deutschland e.V.",
    );
  });
});

test.describe("UItoTop", () => {
  test("fades in after 200 px and scrolls back to the top", async ({ page }) => {
    await page.goto("/");
    const toTop = page.locator("#toTop");
    await expect(toTop).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(toTop).toBeVisible();
    await toTop.click();
    expect(await waitForScrollEnd(page)).toBe(0);
    await expect(toTop).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("head", () => {
  for (const path of ["/", "/wahlometer/"]) {
    test(`${path}: title, meta, Open Graph, icons and manifest from head.yaml`, async ({
      page,
    }) => {
      const head = contentYaml<Head>("site/head.yaml");
      await page.goto(path);
      await expect(page).toHaveTitle(head.title);

      for (const [name, content] of Object.entries(head.meta)) {
        await expect(page.locator(`head meta[name="${name}"]`)).toHaveAttribute("content", content);
      }
      for (const [key, content] of Object.entries(head.openGraph)) {
        await expect(page.locator(`head meta[property="og:${key}"]`)).toHaveAttribute(
          "content",
          content,
        );
      }
      await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute(
        "content",
        head.title,
      );
      await expect(page.locator('head meta[name^="twitter:"]')).toHaveCount(0);

      await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(
        head.icons.filter((icon) => icon.rel === "apple-touch-icon").length,
      );
      for (const href of await page
        .locator(
          'head link[rel="icon"], head link[rel="apple-touch-icon"], head link[rel="manifest"]',
        )
        .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href))) {
        const response = await page.request.get(href);
        expect(response.status(), href).toBe(200);
      }
      await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute(
        "href",
        head.manifest,
      );
    });
  }
});

test.describe("legacy links", () => {
  const cases: Array<[string, RegExp]> = [
    ["/#!wahlometer", /\/wahlometer\/$/],
    ["/#!home", /localhost:\d+\/$/],
    ["/#!about", /\/ueber-uns\/$/],
    ["/#!press", /\/presse\/$/],
    ["/#!engineering#help", /\/engineering\/#help$/],
    ["/#!wahlometer#wom-campaign-container", /\/wahlometer\/#wom-campaign-container$/],
    ["/?page=unsubscribe&token=abc", /\/unsubscribe\/\?token=abc$/],
    ["/?_escaped_fragment_=donate", /\/spenden\/$/],
    ["/#!gibt-es-nicht", /localhost:\d+\/$/],
    ["/democracy/", /localhost:\d+\/$/],
  ];
  for (const [from, to] of cases) {
    test(`${from} → ${to}`, async ({ page }) => {
      await page.goto(from);
      await expect(page).toHaveURL(to);
    });
  }

  test("a later hash change to #!state forwards as well", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => (window.location.hash = "#!wahlometer"));
    await expect(page).toHaveURL(/\/wahlometer\/$/);
  });
});
