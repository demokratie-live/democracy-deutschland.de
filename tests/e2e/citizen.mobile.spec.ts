import { expect, test } from "@playwright/test";

for (const { path, hotspot } of [
  { path: "/buerger/", hotspot: ".hotspot5" },
  { path: "/politiker/", hotspot: ".hotspot1p" },
]) {
  test(`${path}: tapping a hotspot shows its tooltip inside the screen, tapping elsewhere hides it`, async ({
    page,
  }) => {
    await page.goto(path);
    const spot = page.locator(hotspot);
    // Smaller hotspots below 500 px (default_citizen.css).
    await expect(spot).toHaveCSS("width", "20px");
    await spot.tap();
    const tooltip = page.locator("body > .tooltip.show");
    await expect(tooltip).toHaveCount(1);
    // Popper's preventOverflow keeps the tip (max. 370 px plus padding) inside
    // the viewport; the exact position matches live (pnpm compare --hover).
    const box = (await tooltip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    const arrow = (await tooltip.locator(".arrow").boundingBox())!;
    const target = (await spot.boundingBox())!;
    expect(Math.abs(arrow.x + arrow.width / 2 - (target.x + target.width / 2))).toBeLessThan(2);

    await page.locator("h4.subheading").tap();
    await expect(page.locator(".tooltip")).toHaveCount(0);
  });
}
