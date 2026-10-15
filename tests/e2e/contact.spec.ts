import { expect, test, type Page } from "@playwright/test";
import { mailtoUrl } from "../../src/lib/forms";
import { formsSchema } from "../../src/lib/schemas/site";
import { contentYaml, trackErrors } from "./helpers";

const forms = formsSchema.parse(contentYaml("site/forms.yaml"));
const { messages } = forms;

const FIELDS = ["#vorname", "#nachname", "#email", "#text"] as const;

async function fill(page: Page, values: [string, string, string, string]) {
  for (const [index, selector] of FIELDS.entries()) await page.fill(selector, values[index]);
}

/** Clicks "Absenden!" and returns the alert text (dismissed like a user would). */
async function submitExpectingAlert(page: Page) {
  const alerts: string[] = [];
  page.once("dialog", async (dialog) => {
    alerts.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });
  await page.click("#send_contact");
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toMatch(/^alert: /);
  return alerts[0].slice("alert: ".length);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/kontakt/");
});

test("loads without errors, navbar marks nothing (like init_contact)", async ({ page }) => {
  const errors = trackErrors(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
  await expect(page.locator(".nav-item.active")).toHaveCount(0);
  await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
  const address = await page
    .locator("#content .col-12")
    .first()
    .evaluate((el: HTMLElement) => el.innerText);
  expect(address).toBe(
    "DEMOCRACY Deutschland e.V.\nAm Klausberge 12\n37075 Göttingen\nTel +49 - (0)176 - 47040213\ncontact@democracy-deutschland.de",
  );
});

test("fields and button in the order of default_contact.tpl", async ({ page }) => {
  const controls = page.locator("#form .form-control");
  await expect(controls).toHaveCount(4);
  const attributes = await controls.evaluateAll((elements) =>
    elements.map((element) => [
      element.id,
      element.tagName.toLowerCase(),
      element.getAttribute("type"),
      element.getAttribute("placeholder"),
    ]),
  );
  expect(attributes).toEqual([
    ["vorname", "input", "text", "Vorname"],
    ["nachname", "input", "text", "Nachname"],
    ["email", "input", "email", "Email"],
    ["text", "textarea", null, "Deine Nachricht..."],
  ]);
  await expect(page.locator("#text")).toHaveAttribute("rows", "15");
  await expect(page.locator("#send_contact")).toHaveText("  Absenden!");
  await expect(page.locator("#send_contact i.fa.fa-envelope")).toHaveCount(1);
});

test("checks the fields in order: alert, then focus on the field", async ({ page }) => {
  const cases: Array<[[string, string, string, string], string, string]> = [
    [["", "", "", ""], messages.firstName, "#vorname"],
    [["Ma", "Mustermann", "max@example.org", "Hallo"], messages.firstName, "#vorname"],
    [["Max", "Mu", "max@example.org", "Hallo"], messages.lastName, "#nachname"],
    // Live stops here with a ReferenceError (validateEmail is not defined).
    [["Max", "Mustermann", "max@example", "Hallo"], messages.email, "#email"],
    [["Max", "Mustermann", "max@example.org", "Ha"], messages.text, "#text"],
  ];
  for (const [values, message, focused] of cases) {
    await fill(page, values);
    await page.locator("#send_contact").scrollIntoViewIfNeeded();
    expect(await submitExpectingAlert(page)).toBe(message);
    await expect(page.locator(focused)).toBeFocused();
  }
});

test("without endpoint the button opens a prefilled mailto and keeps the form", async ({
  page,
}) => {
  const errors = trackErrors(page);
  let dialogs = 0;
  page.on("dialog", (dialog) => {
    dialogs++;
    void dialog.dismiss();
  });
  const values: [string, string, string, string] = [
    "Max",
    "Mustermann",
    "max@example.org",
    "Hallo DEMOCRACY-Team,\nwie geht's? 100% & mehr",
  ];
  await fill(page, values);
  const request = page.waitForRequest((r) => r.url().startsWith("mailto:"));
  await page.click("#send_contact");
  // The browser escapes a few more characters (', !), so compare decoded.
  const decode = (url: string) => {
    const [address, query] = url.split("?");
    return [address, Object.fromEntries(new URLSearchParams(query))];
  };
  expect(decode((await request).url())).toEqual(
    decode(
      mailtoUrl({
        to: forms.recipient,
        subject: "DEMOCRACY Website: contact",
        fields: [
          ["Vorname", values[0]],
          ["Nachname", values[1]],
          ["Email", values[2]],
        ],
        text: values[3],
      }),
    ),
  );
  await expect(page).toHaveURL(/\/kontakt\/$/);
  for (const [index, selector] of FIELDS.entries()) {
    await expect(page.locator(selector)).toHaveValue(values[index]);
  }
  expect(dialogs).toBe(0);
  expect(errors).toEqual([]);
});

test("Enter in a field does not submit the form (no submit button)", async ({ page }) => {
  await page.fill("#vorname", "Max");
  await page.press("#vorname", "Enter");
  await expect(page).toHaveURL(/\/kontakt\/$/);
  await expect(page.locator("#vorname")).toHaveValue("Max");
});

test("links to /kontakt/ from the footer and the FAQ work", async ({ page }) => {
  await page.goto("/faq/");
  await page.locator("#content .col-12 > h5 a").click();
  await expect(page).toHaveURL(/\/kontakt\/$/);
  await expect(page.locator("#send_contact")).toBeVisible();
  await page.goto("/");
  await page.locator(".footer-rechtliches a", { hasText: "Kontakt" }).click();
  await expect(page).toHaveURL(/\/kontakt\/$/);
});

test("legacy link #!contact forwards to /kontakt/", async ({ page }) => {
  await page.goto("/#!contact");
  await expect(page).toHaveURL(/\/kontakt\/$/);
  await expect(page.locator("#send_contact")).toBeVisible();
});
