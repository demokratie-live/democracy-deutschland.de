import fs from "fs";
import path from "path";
import { expect, test, type Page } from "@playwright/test";
import { contentYaml, trackErrors, waitForScrollEnd } from "./helpers";

interface DonationYaml {
  donation_date: string;
  donation_paten: number;
  donation_data: { type: number; text_description?: string; text_cost?: string }[];
}

const donation = contentYaml<DonationYaml>("donate/donation.yaml");

/** Every bar must cover its row like updateProgress() in donate_details.tpl. */
async function barsMatchRows(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLTableRowElement>(".donate-details tr")]
      .filter((tr) => tr.querySelector(".donate-detail-progress"))
      .every((tr) => {
        const bar = tr.querySelector<HTMLElement>(".donate-detail-progress")!;
        return (
          bar.style.height === `${tr.clientHeight - 1}px` && bar.style.top === `${tr.offsetTop}px`
        );
      }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/spenden/");
});

test("loads without errors, navbar marks Spenden", async ({ page }) => {
  const errors = trackErrors(page);
  await page.reload();
  await expect(page.locator("#statement-heading")).toHaveText("Spenden");
  await expect(page.locator(".nav-item.active")).toHaveText("Spenden");
  await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("donation figures come from donation.yaml", async ({ page }) => {
  const progress = page.locator("progress");
  await expect(progress).toHaveCount(2);
  for (const bar of await progress.all()) {
    await expect(bar).toHaveAttribute("value", "17");
    await expect(bar).toHaveAttribute("data-label", "17% von 9.300€ GESCHAFFT!");
  }
  await expect(page.locator(".col-lg-4").first()).toContainText(
    `${donation.donation_paten} VON 2.000`,
  );
  await expect(page.getByText(`Stand: ${donation.donation_date}`)).toBeVisible();
  await expect(page.getByText("1.563€ von 9.300€")).toHaveCount(2);

  const heads = donation.donation_data.filter((item) => item.type === 0);
  const rows = donation.donation_data.filter((item) => item.type === 1);
  await expect(page.locator(".donate-details-head")).toHaveCount(heads.length);
  await expect(page.locator(".donate-details-head th:nth-child(2)")).toHaveText(
    heads.map((item) => item.text_description ?? ""),
  );
  await expect(page.locator(".donate-details-cost-text")).toHaveText(
    rows.map((item) => item.text_cost ?? ""),
  );
  await expect(page.locator(".donate-details-cost").nth(2)).toHaveText("3.000€");
  await expect(page.locator(".donate-detail-progress").nth(5)).toHaveAttribute(
    "style",
    /width: 23%/,
  );
});

test("progress bars cover their rows, also after a resize", async ({ page }) => {
  const styles = () =>
    page
      .locator(".donate-detail-progress")
      .evaluateAll((bars) => bars.map((bar) => bar.getAttribute("style")).join("|"));
  await expect.poll(() => barsMatchRows(page)).toBe(true);
  const before = await styles();
  await page.setViewportSize({ width: 600, height: 800 });
  await expect.poll(styles).not.toBe(before);
  expect(await barsMatchRows(page)).toBe(true);
});

test("donate button opens the Patenschaft modal, the close button hides it", async ({ page }) => {
  const modal = page.locator("#DEMOCRACYPatenschaft");
  const button = page.locator("#donate-button");
  await expect(modal).toBeHidden();
  await expect(modal).toHaveAttribute("aria-hidden", "true");

  await button.click();
  await expect(page.locator("body")).toHaveClass(/modal-open/);
  await expect(page.locator("body > .modal-backdrop.fade.show")).toHaveCount(1);
  await expect(modal).toHaveClass("modal fade show");
  await expect(modal).toHaveAttribute("style", /display: block/);
  await expect(modal).not.toHaveAttribute("aria-hidden");
  await expect(modal).toBeFocused();
  await expect(modal.getByRole("link", { name: "Weiter zu PayPal" })).toHaveAttribute(
    "href",
    "https://www.paypal.com/donate?hosted_button_id=PR4PJL4AY8RSL",
  );

  await modal.locator(".close").click();
  await expect(modal).toBeHidden();
  await expect(modal).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
  await expect(button).toBeFocused();
});

test("modal closes on a backdrop click and on Escape, not on a click inside", async ({ page }) => {
  const modal = page.locator("#DEMOCRACYPatenschaft");
  await page.locator("#donate-button").click();
  await expect(modal).toBeFocused();
  await modal.getByText("Dauerauftrag via Bankverbindung").click();
  await expect(modal).toHaveClass(/show/);

  await page.mouse.click(10, 400);
  await expect(modal).toBeHidden();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);

  await page.locator("#donate-button").click();
  await expect(modal).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
});

test("Pate/Spenden buttons scroll to the bank details on the same page", async ({ page }) => {
  for (const label of ["Jetzt Pate werden", "Einmalig Spenden"]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByText(label).click();
    await expect(page).toHaveURL(/\/spenden\/#donate$/);
    const y = await waitForScrollEnd(page);
    const target = await page.evaluate(
      () => document.getElementById("donate")!.getBoundingClientRect().top + window.scrollY,
    );
    expect(Math.abs(y - target)).toBeLessThanOrEqual(1);
  }
});

test("downloads exist under the old /files/download/ paths", async ({ page }) => {
  const links = page.locator('a[href^="/files/download/"]');
  const hrefs = await links.evaluateAll((anchors) =>
    anchors.map((a) => [a.getAttribute("href")!, a.getAttribute("target")]),
  );
  expect(hrefs.map(([href]) => href)).toEqual(
    expect.arrayContaining([
      "/files/download/Freistellungsbescheid.pdf",
      "/files/download/Satzung_DEMOCRACY.pdf",
      "/files/download/Vereinfachter_Zuwendungsnachweis_2025.pdf",
      "/files/download/JA_2017_DEMOCRACY.PDF",
      "/files/download/JA_2025_DEMOCRACY.pdf",
      "/files/download/MariusKrueger_DEMOCRACY_HIKAbschlussbericht.pdf",
    ]),
  );
  expect(hrefs).toHaveLength(13);
  // Files the app links to (democracy-client src/screens/Donate/content.ts).
  const files = [
    ...hrefs.map(([href]) => href),
    "/files/download/Gemeinnutzigkeit_DEMOCRACY.pdf",
    "/files/download/Vereinfachter_Zuwendungsnachweis.pdf",
  ];
  for (const [, target] of hrefs) expect(target).toBe("_blank");
  for (const file of files) {
    const response = await page.request.get(file);
    expect(response.status(), file).toBe(200);
    expect((await response.body()).subarray(0, 5).toString(), file).toBe("%PDF-");
  }
});

test("volunteer link points to the engineering page", async ({ page }) => {
  await expect(page.getByText("Als Freiwilliger melden.")).toHaveAttribute("href", "/engineering/");
});

test("api.php and api/donation_status.json serve the donation status", async ({ request }) => {
  const live = fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/donation_status.live.json"),
    "utf-8",
  );
  const expected = live.replace(/^\{"querytime":[0-9.]+,/, '{"querytime":0,');
  // The app requests ?call=donation_status; a static host ignores the query.
  const php = await request.get("/api.php?call=donation_status");
  expect(php.status()).toBe(200);
  // serve uses mime-db like GitHub Pages: .php is not served as JSON.
  expect(php.headers()["content-type"]).toBe("application/x-httpd-php");
  expect(await php.text()).toBe(expected);
  expect((await php.json()).result.donation_percentage).toBe(17);

  const json = await request.get("/api/donation_status.json");
  expect(json.status()).toBe(200);
  expect(json.headers()["content-type"]).toContain("application/json");
  expect(await json.text()).toBe(expected);
});
