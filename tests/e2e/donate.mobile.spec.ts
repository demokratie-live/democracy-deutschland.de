import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/spenden/");
});

test("progress bars cover their taller rows on mobile", async ({ page }) => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLTableRowElement>(".donate-details tr")]
          .filter((tr) => tr.querySelector(".donate-detail-progress"))
          .every((tr) => {
            const bar = tr.querySelector<HTMLElement>(".donate-detail-progress")!;
            return (
              bar.style.height === `${tr.clientHeight - 1}px` &&
              bar.style.top === `${tr.offsetTop}px`
            );
          }),
      ),
    )
    .toBe(true);
});

test("Patenschaft modal opens and closes on mobile", async ({ page }) => {
  const modal = page.locator("#DEMOCRACYPatenschaft");
  await page.locator("#donate-button").tap();
  await expect(modal).toHaveClass(/show/);
  await expect(modal).toBeFocused();
  await expect(modal.locator(".modal-dialog")).toBeInViewport();
  await modal.locator(".close").tap();
  await expect(modal).toBeHidden();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
});
