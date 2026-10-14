import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { LegacyUrl } from "./legacy-urls";

/**
 * Client side of tests/legacy-urls.ts on a static host without .htaccess:
 * opens the old URL below `basePath` and checks where the browser ends up.
 * External targets (GitHub releases) are answered locally.
 */
export async function expectClientForwarding(
  page: Page,
  request: APIRequestContext,
  entry: LegacyUrl,
  basePath = "",
) {
  const from = basePath + entry.from;
  if (entry.client === "file") {
    const response = await request.get(from);
    expect(response.status()).toBe(entry.to === null ? 404 : 200);
    return;
  }
  if (entry.to === null) {
    await page.goto(from);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    return;
  }
  if (/^https?:/.test(entry.to)) {
    await page.route(entry.to, (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "release download" }),
    );
    await page.goto(from);
    await expect(page).toHaveURL(entry.to);
    return;
  }
  const response = await page.goto(from);
  if (entry.to === `${entry.from}/`) {
    // Only the trailing slash: the host adds it (GitHub Pages, Apache), `serve`
    // shows the directory under both spellings.
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(basePath + entry.from)}/?$`));
    return;
  }
  await expect(page).toHaveURL(basePath + entry.to);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
