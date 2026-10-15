import { expect, test } from "@playwright/test";
import { FAKE_TOKEN } from "../legacy-urls";
import { trackErrors } from "./helpers";

// Old newsletter mails of the PHP site (before Listmonk) link
// #!unsubscribe;token.<x>; live claims success for every token.
test("/unsubscribe/ explains the way via Listmonk instead of claiming success", async ({
  page,
}) => {
  const errors = trackErrors(page);
  const response = await page.goto(`/unsubscribe/?token=${FAKE_TOKEN}`);
  expect(response?.status()).toBe(200);
  const content = page.locator("#content .main-container.page");
  await expect(content).toHaveCSS("text-align", "left");
  await expect(content.locator("h1")).toHaveText("Unsubscribe");
  const notice = content.locator("h3");
  await expect(notice).toHaveText("Dieser Abmeldelink funktioniert nicht mehr.");
  await expect(notice).not.toHaveCSS("color", "rgb(0, 128, 0)");
  await expect(content).toContainText("über Listmonk");
  await expect(content).toContainText("Link am Ende jeder Newsletter-Mail");
  await expect(content).not.toContainText(/success/i);
  await expect(
    content.getByRole("link", { name: "contact@democracy-deutschland.de" }),
  ).toHaveAttribute("href", "mailto:contact@democracy-deutschland.de");
  // init_unsubscribe(): no active menu item, no startpage navbar
  await expect(page.locator(".nav-item.active")).toHaveCount(0);
  await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
