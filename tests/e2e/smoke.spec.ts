import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

const routes = [
  { path: "/", heading: "Weil deine Stimme zählt!" },
  { path: "/wahlometer/", heading: "Dein faktenbasierter Wahlhelfer" },
];

for (const route of routes) {
  test(`${route.path} loads without errors`, async ({ page }) => {
    const errors = trackErrors(page);
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("#index-headline")).toHaveText(route.heading);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}

test("original stylesheets and fonts load", async ({ page }) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith("http://localhost") && response.status() >= 400) {
      failed.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
  });
  expect(fonts).toEqual(
    expect.arrayContaining([
      "helvetica",
      "helvetica_bold",
      "edosz",
      "isabelle_layne",
      "SFProDisplay",
      "icomoon",
      "Font Awesome 5 Brands",
      "Font Awesome 5 Free",
    ]),
  );
  // Bootstrap is active: the navbar is fixed.
  await expect(page.locator("nav.navbar")).toHaveCSS("position", "fixed");
  expect(failed).toEqual([]);
});

test("unknown paths render the 404 page inside the frame", async ({ page }) => {
  const response = await page.goto("/nonexistent-page-xyz/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
});
