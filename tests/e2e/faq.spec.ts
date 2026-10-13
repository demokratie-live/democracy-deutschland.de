import { expect, test, type Page } from "@playwright/test";
import { faqSchema } from "../../src/lib/schemas/faq";
import { contentYaml, trackErrors } from "./helpers";

const faq = faqSchema.parse(contentYaml("faq/faq.yaml"));
const indexesOf = (category?: string) =>
  faq.questions.flatMap((question, index) =>
    !category || question.categories.includes(category) ? [index] : [],
  );
const finanzen = indexesOf("finanzen");

const panels = (page: Page) => page.locator(".panel-faq");
const menuItem = (page: Page, label: string) => page.locator(".faq-menu", { hasText: label });

/** Open questions (class "show"), after the collapse transitions have finished. */
async function expectOpen(page: Page, open: number[]) {
  await expect(page.locator(".panel-faq .collapsing")).toHaveCount(0);
  for (const [index] of faq.questions.entries()) {
    const panel = panels(page).nth(index);
    if (open.includes(index)) {
      await expect(panel.locator(".panel-collapse")).toHaveClass(/\bshow\b/);
      await expect(panel.locator(".openarrow")).toHaveCSS("transform", /^matrix\(-1,/);
    } else {
      await expect(panel.locator(".panel-collapse")).not.toHaveClass(/\bshow\b/);
      await expect(panel.locator(".openarrow")).not.toHaveCSS("transform", /matrix\(-1/);
    }
  }
}

async function expectVisible(page: Page, visible: number[]) {
  for (const [index] of faq.questions.entries()) {
    if (visible.includes(index)) await expect(panels(page).nth(index)).toBeVisible();
    else await expect(panels(page).nth(index)).toBeHidden();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/faq/");
});

test("loads without errors, navbar marks nothing (like init_faq)", async ({ page }) => {
  const errors = trackErrors(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
  await expect(page.locator(".nav-item.active")).toHaveCount(0);
  await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
  await expect(page.locator("#content h1")).toHaveText("Häufige Fragen (FAQ)");
  await expect(page.locator("#content .col-12 > h5 a")).toHaveAttribute("href", "/kontakt/");
});

test("menu and questions come from faq.yaml, the first question is open", async ({ page }) => {
  await expect(page.locator(".faq-menu")).toHaveText(faq.menu.map((item) => item.label));
  await expect(page.locator(".faq-menu.active")).toHaveText(faq.menu[0].label);
  await expect(page.locator(".faq_header")).toHaveText(faq.questions.map((q) => q.question));
  for (const [index, question] of faq.questions.entries()) {
    await expect(panels(page).nth(index)).toHaveClass(`panel-faq ${question.categories.join(" ")}`);
  }
  await expectOpen(page, [0]);
});

test("answers render the MDX of faq.yaml without paragraphs", async ({ page }) => {
  await expect(page.locator(".panel-body p")).toHaveCount(0);
  const first = page.locator("#collapse0 .panel-body");
  await expect(first.locator("br")).toHaveCount(3);
  await expect(first.getByRole("link", { name: "hier" })).toHaveAttribute("href", "/datenschutz/");
  await expect(first.locator('a[target="_blank"]')).toHaveAttribute(
    "href",
    "https://github.com/demokratie-live/democracy-development/wiki/Stimmanonymit%C3%A4t",
  );
  await expect(page.locator("#collapse1 .panel-body > ul")).toHaveCount(2);
});

test("each question opens and closes on its own, the arrow turns", async ({ page }) => {
  await page.locator(".faq_header").nth(1).click();
  await expectOpen(page, [0, 1]);
  await page.locator(".faq_header2").nth(0).click();
  await expectOpen(page, [1]);
  await page.locator(".faq_header").nth(1).click();
  await expectOpen(page, []);
  // The toggles do not change the URL (no #collapseN, no #!faq).
  await expect(page).toHaveURL(/\/faq\/$/);
});

test("the category menu filters and opens the first visible question", async ({ page }) => {
  await menuItem(page, "FINANZEN").click();
  await expect(page.locator(".faq-menu.active")).toHaveText("FINANZEN");
  await expectVisible(page, finanzen);
  await expectOpen(page, [finanzen[0]]);

  await menuItem(page, "BETA").click();
  await expect(page.locator(".faq-menu.active")).toHaveText("BETA");
  await expectVisible(page, indexesOf("beta"));
  await expectOpen(page, []);

  await menuItem(page, "ALLE").click();
  await expectVisible(page, indexesOf());
  await expectOpen(page, [0]);
  await expect(page).toHaveURL(/\/faq\/$/);
});

test("the first visible question stays open when it already is (live bug fixed)", async ({
  page,
}) => {
  // Live: "ALLE" right after loading closes question 1 and opens question 2.
  await page.locator(".faq_header").nth(2).click();
  await expectOpen(page, [0, 2]);
  await menuItem(page, "ALLE").click();
  await expectOpen(page, [0]);

  await menuItem(page, "FINANZEN").click();
  await expectOpen(page, [finanzen[0]]);
  await menuItem(page, "FINANZEN").click();
  await expectOpen(page, [finanzen[0]]);
});
