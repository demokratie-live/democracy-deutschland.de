import { expect, test } from "@playwright/test";
import { getLatestBlogPosts } from "../../src/lib/content/blog";
import { pressMediaSchema, type PressItem } from "../../src/lib/schemas/press";
import { contentYaml, trackErrors } from "./helpers";

const media = pressMediaSchema.parse(contentYaml("press/media.yaml"));

test.beforeEach(async ({ page }) => {
  await page.goto("/presse/");
});

/** Tiles of the `.row` whose heading is `heading`. */
const tiles = (page: import("@playwright/test").Page, heading: string) =>
  page
    .locator(".main-container > .row", { has: page.locator(`h1:text-is("${heading}")`) })
    .locator(".col-md-4");

async function expectTiles(
  page: import("@playwright/test").Page,
  heading: string,
  items: Array<Pick<PressItem, "title" | "link"> & { img?: string }>,
) {
  const list = tiles(page, heading);
  await expect(list).toHaveCount(items.length);
  for (const [index, item] of items.entries()) {
    const tile = list.nth(index);
    await expect(tile.locator("h5")).toHaveText(item.title);
    await expect(tile.locator("a")).toHaveAttribute("href", item.link);
    await expect(tile.locator("a")).toHaveAttribute("target", "_blank");
    await expect(tile.locator("img")).toHaveAttribute("alt", item.title);
    if (item.img) await expect(tile.locator("img")).toHaveAttribute("src", item.img);
  }
}

test("loads without errors, navbar marks nothing (like init_press)", async ({ page }) => {
  const errors = trackErrors(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
  await expect(page.locator(".nav-item.active")).toHaveCount(0);
  await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
  await expect(page.locator("#content h1")).toHaveText([
    "Presse-Kit",
    "Blogs",
    "Pressespiegel",
    "Publikationen",
  ]);
});

test("media tiles come from media.yaml", async ({ page }) => {
  await expectTiles(page, "Presse-Kit", media.kit);
  await expectTiles(page, "Pressespiegel", media.articles);
  await expectTiles(page, "Publikationen", media.publications);
});

test("blog teasers are the 9 newest posts of content/blog/, linked to their permalink", async ({
  page,
}) => {
  const posts = await getLatestBlogPosts(9);
  expect(posts).toHaveLength(9);
  await expectTiles(
    page,
    "Blogs",
    posts.map(({ frontmatter, permalink }) => ({
      title: frontmatter.title,
      link: permalink,
      img: frontmatter.image,
    })),
  );
  // Newest first, permalinks like WordPress (/blog/<year>/<month>/<slug>/).
  const dates = posts.map((post) => post.frontmatter.date);
  expect(dates).toEqual([...dates].sort().reverse());
  for (const { frontmatter, permalink } of posts) {
    expect(permalink).toBe(
      `/blog/${frontmatter.date.slice(0, 4)}/${frontmatter.date.slice(5, 7)}/${frontmatter.slug}/`,
    );
  }
});

test("every image and download is served locally", async ({ page }) => {
  await page.waitForLoadState("networkidle");
  const images = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>("#content img")].map((img) => ({
      src: img.src,
      loaded: img.complete && img.naturalWidth > 0,
    })),
  );
  expect(images.length).toBeGreaterThan(40);
  for (const image of images) {
    expect(image.src, "no hotlinking to the old server").toMatch(/^http:\/\/localhost:\d+\//);
    expect(image.loaded, image.src).toBe(true);
  }
  const downloads = await page
    .locator('#content a[href^="/files/"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  expect(downloads.length).toBeGreaterThan(0);
  for (const href of downloads) {
    expect((await page.request.get(href)).status(), href).toBe(200);
  }
});

test("the overlay slides up on hover", async ({ page }) => {
  const overlay = tiles(page, "Presse-Kit").first().locator(".overlay");
  await expect(overlay).toHaveCSS("top", "160px");
  await overlay.hover();
  await expect(overlay).toHaveCSS("top", "0px");
});

test("contact button leads to /kontakt/", async ({ page }) => {
  await expect(page.getByRole("link", { name: "KONTAKTFORMULAR" })).toHaveAttribute(
    "href",
    "/kontakt/",
  );
});
