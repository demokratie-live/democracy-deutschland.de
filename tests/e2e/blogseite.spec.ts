import { expect, test, type Page } from "@playwright/test";
import { trackErrors } from "./helpers";

/** Height attribute and content height of the blog frame once they agree (resizeIframe). */
async function frameHeights(page: Page) {
  const frame = page.locator("#blogiframe");
  await expect
    .poll(() =>
      frame.evaluate((iframe: HTMLIFrameElement) => {
        const body = iframe.contentDocument?.body;
        return body && iframe.getAttribute("height") === `${body.scrollHeight}px`;
      }),
    )
    .toBe(true);
  return frame.evaluate((iframe: HTMLIFrameElement) => iframe.offsetHeight);
}

test("/blogseite/ shows the static blog in the website frame, as high as its page", async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto("/blogseite/");
  const frame = page.locator("#blogiframe");
  await expect(frame).toHaveAttribute("src", "/blog/");
  await expect(frame).toHaveAttribute("style", "width:100%;min-height:150vh");
  await expect(page.locator("#content .main-container")).toHaveAttribute(
    "style",
    "text-align:left;margin-bottom:75px",
  );
  // init_blog(): no active menu item, no startpage class.
  await expect(page.locator(".nav-item.active")).toHaveCount(0);
  await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
  const indexHeight = await frameHeights(page);
  expect(indexHeight).toBeGreaterThan(5000);

  // A link inside the frame loads the post there; the frame follows its height.
  const blog = page.frameLocator("#blogiframe");
  await blog.locator(".post-title a").first().click();
  await expect(blog.locator("article.post.single")).toBeVisible();
  const postHeight = await frameHeights(page);
  expect(postHeight).not.toBe(indexHeight);
  expect(errors).toEqual([]);
});

test("footer link and the old #!blog lead to /blogseite/", async ({ page }) => {
  await page.goto("/");
  await page.locator(".footer a", { hasText: /^Blog$/ }).click();
  await expect(page).toHaveURL("/blogseite/");
  await page.goto("/#!blog");
  await expect(page).toHaveURL("/blogseite/");
});
