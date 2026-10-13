import { expect, test, type Page } from "@playwright/test";
import { formatPostDate } from "../../src/lib/blog/format";
import { wptexturize } from "../../src/lib/blog/texturize";
import { getBlogPosts, getBlogSite, type BlogPost } from "../../src/lib/content/blog";
import { contentYaml, trackErrors } from "./helpers";

// Expected values come from content/blog/ (the import), never from live.
let posts: BlogPost[];
let perPage: number;
let pages: number;
const missing = new Set(contentYaml<string[]>("blog/missing-uploads.yaml"));

test.beforeAll(async () => {
  posts = await getBlogPosts();
  perPage = (await getBlogSite()).postsPerPage;
  pages = Math.ceil(posts.length / perPage);
});

const pageUrl = (page: number) => (page === 1 ? "/blog/" : `/blog/page/${page}/`);
const bySlug = (slug: string) => posts.find((post) => post.frontmatter.slug === slug)!;

/** Images of the page that should load: local, not in the list of uploads already missing live. */
async function expectImagesLoaded(page: Page) {
  await page.evaluate(() =>
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
      img.loading = "eager";
    }),
  );
  // Wait for every image itself: networkidle can fall between two requests under load.
  await page.evaluate(() =>
    Promise.all(
      [...document.images]
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
        ),
    ),
  );
  const images = await page.evaluate(() =>
    [...document.images].map((img) => ({
      src: img.getAttribute("src") ?? "",
      url: img.src,
      loaded: img.complete && img.naturalWidth > 0,
    })),
  );
  for (const image of images) {
    expect(image.url, "no hotlinking to the old server").not.toMatch(
      /democracy-deutschland\.de\/blog\/wp-content/,
    );
    if (!image.url.startsWith("http://localhost")) continue;
    if (missing.has(decodeURI(new URL(image.url).pathname))) continue;
    expect(image.loaded, image.src).toBe(true);
  }
}

test("every blog page and permalink is exported", async ({ request }) => {
  const urls = [
    ...Array.from({ length: pages }, (_, index) => pageUrl(index + 1)),
    ...posts.map((post) => post.permalink),
  ];
  // One file per WordPress post (the import writes exactly the REST posts).
  expect(posts.length).toBeGreaterThan(0);
  expect(new Set(posts.map((post) => post.frontmatter.wpId)).size).toBe(posts.length);
  for (const url of urls) {
    expect((await request.get(url)).status(), url).toBe(200);
  }
});

test("index: Lovecraft frame, ten newest posts with image, meta and teaser", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/blog/");
  await expect(page).toHaveTitle("DEMOCRACY Blog");
  await expect(page.locator("body")).toHaveClass("home blog wp-theme-lovecraft");
  await expect(page.locator("html")).toHaveClass("js");
  await expect(page.locator("h1.blog-title a")).toHaveText("DEMOCRACY Blog");
  await expect(page.locator("h1.blog-title a")).toHaveAttribute("href", "/blog/");
  await expect(page.locator("figure.header-image img")).toHaveAttribute(
    "src",
    (await getBlogSite()).headerImage,
  );

  const entries = page.locator("#posts > .post");
  await expect(entries).toHaveCount(perPage);
  for (const [index, post] of posts.slice(0, perPage).entries()) {
    const entry = entries.nth(index);
    await expect(entry).toHaveAttribute("id", `post-${post.frontmatter.wpId}`);
    await expect(entry.locator(".post-title a")).toHaveText(wptexturize(post.frontmatter.title));
    await expect(entry.locator(".post-title a")).toHaveAttribute("href", post.permalink);
    await expect(entry.locator(".post-date a")).toHaveText(formatPostDate(post.frontmatter.date));
    await expect(entry.locator(".post-author a")).toHaveAttribute(
      "href",
      `/blog/author/${post.frontmatter.author}/`,
    );
    await expect(entry.locator(".post-categories a")).toHaveAttribute(
      "href",
      `/blog/category/${post.frontmatter.categories[0]}/`,
    );
    await expect(entry.locator(".more-link")).toHaveText("Weiterlesen");
    await expect(entry.locator(".more-link")).toHaveAttribute("href", post.permalink);
    // The teaser ends at <!--more-->: no "more" span on the index.
    await expect(entry.locator(`#more-${post.frontmatter.wpId}`)).toHaveCount(0);
  }
  // WordPress: the first image fetchpriority=high, the next two eager, then lazy.
  const featured = entries.locator(".post-image img");
  await expect(featured.nth(0)).toHaveAttribute("fetchpriority", "high");
  await expect(featured.nth(1)).not.toHaveAttribute("loading", "lazy");
  await expect(featured.nth(3)).toHaveAttribute("loading", "lazy");
  await expect(featured.nth(3)).toHaveAttribute("sizes", /^auto, /);

  await expect(page.locator(".archive-navigation .fleft")).toHaveText(`Seite 1 von ${pages}`);
  await expect(page.locator(".archive-navigation .fright a")).toHaveText(["Nächster"]);
  await expect(page.locator(".archive-navigation .fright a")).toHaveAttribute(
    "href",
    "/blog/page/2/",
  );
  await expectImagesLoaded(page);
  expect(errors).toEqual([]);
});

test("page 2 and the last page link back and forth", async ({ page }) => {
  await page.goto("/blog/page/2/");
  await expect(page).toHaveTitle("DEMOCRACY Blog – Seite\u00a02");
  await expect(page.locator("body")).toHaveClass("home blog paged paged-2 wp-theme-lovecraft");
  await expect(page.locator("#posts > .post").first()).toHaveAttribute(
    "id",
    `post-${posts[perPage].frontmatter.wpId}`,
  );
  await expect(page.locator(".archive-navigation .fright a")).toHaveText([
    "Vorheriger",
    "Nächster",
  ]);
  await page.getByRole("link", { name: "Vorheriger" }).click();
  await expect(page).toHaveURL(/\/blog\/$/);

  await page.goto(pageUrl(pages));
  await expect(page.locator("#posts > .post")).toHaveCount(posts.length - (pages - 1) * perPage);
  await expect(page.locator(".archive-navigation .fright a")).toHaveText(["Vorheriger"]);
  // News #2: the closed logo tag keeps the sidebar next to the posts (docs/abweichungen.md).
  await expect(page.locator(".section-inner > aside.sidebar")).toHaveCount(1);
  await expectImagesLoaded(page);
});

test("single post: header image, title, meta, content, tags and neighbours", async ({ page }) => {
  const errors = trackErrors(page);
  const post = bySlug("in-luetzerath-verlaeuft-die-demokratiegrenze");
  const index = posts.indexOf(post);
  await page.goto(post.permalink);
  await expect(page).toHaveTitle(`${post.frontmatter.title} – DEMOCRACY Blog`);
  await expect(page.locator("body")).toHaveClass(
    `wp-singular post-template-default single single-post postid-${post.frontmatter.wpId} single-format-standard wp-theme-lovecraft has-featured-image`,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `https://democracy-deutschland.de${post.permalink}`,
  );
  await expect(page.locator('link[rel="shortlink"]')).toHaveAttribute(
    "href",
    `https://democracy-deutschland.de/blog/?p=${post.frontmatter.wpId}`,
  );
  await expect(page.locator("div.blog-title a")).toHaveText("DEMOCRACY Blog");
  const header = page.locator("figure.header-image img");
  await expect(header).toHaveAttribute("fetchpriority", "high");
  await expect(header).toHaveClass(/size-post-image-cover/);
  await expect(page.locator("article h1.post-title")).toHaveText(post.frontmatter.title);
  await expect(page.locator(`article #more-${post.frontmatter.wpId}`)).toHaveCount(1);
  await expect(page.locator(".post-tags a")).toHaveText([
    "Democracy",
    "Demokratie",
    "Kommentar",
    "Lützrath",
    "Räumung",
  ]);
  await expect(page.locator(".post-tags a").first()).toHaveAttribute(
    "href",
    "/blog/tag/democracy/",
  );
  // "Vorheriger" is the older post, "Nächster" the newer one, like WordPress.
  await expect(page.locator(".post-nav-prev a")).toHaveAttribute(
    "href",
    posts[index + 1].permalink,
  );
  await expect(page.locator(".post-nav-next a")).toHaveAttribute(
    "href",
    posts[index - 1].permalink,
  );
  await expectImagesLoaded(page);
  expect(errors).toEqual([]);
});

test("block styles in <head> follow the content like in WordPress", async ({ page }) => {
  await page.goto(bySlug("spendenkonto-zieht-um").permalink);
  await expect(page.locator("style#wp-block-quote-inline-css")).toHaveCount(1);
  await expect(page.locator("style#wp-block-list-inline-css")).toHaveCount(1);
  await expect(page.locator("style#wp-block-gallery-inline-css")).toHaveCount(0);
  await page.goto(bySlug("berlin-waehlen-ist-nicht-abstimmen").permalink);
  await expect(page.locator("style#wp-block-gallery-inline-css")).toHaveCount(1);
  await expect(page.locator("style#core-block-supports-inline-css")).toHaveCount(1);
  // The gallery draws wp_unique_id() before the search widget.
  await expect(page.locator(".wp-block-search__input")).toHaveAttribute(
    "id",
    "wp-block-search__input-2",
  );
  // No emoji script (decision Manuel 2026-10-13), no jQuery.
  await expect(page.locator('script[src*="wp-emoji"], script[src*="jquery"]')).toHaveCount(0);
});

test("sidebar: search, newest posts, comments, archives and categories", async ({ page }) => {
  await page.goto("/blog/");
  const sidebar = page.locator("aside.sidebar");
  await expect(sidebar.locator("h2")).toHaveText([
    "Neueste Beiträge",
    "Neueste Kommentare",
    "Archive",
    "Kategorien",
  ]);
  await expect(sidebar.locator("form")).toHaveAttribute("action", "/blog/");
  await expect(sidebar.locator(".wp-block-latest-posts a")).toHaveText(
    posts.slice(0, 5).map((post) => wptexturize(post.frontmatter.title)),
  );
  await expect(sidebar.locator(".wp-block-latest-comments")).toHaveText(
    "Es sind keine Kommentare vorhanden.",
  );
  const months = [...new Set(posts.map((post) => post.frontmatter.date.slice(0, 7)))];
  await expect(sidebar.locator(".wp-block-archives a")).toHaveCount(months.length);
  await expect(sidebar.locator(".wp-block-archives a").first()).toHaveAttribute(
    "href",
    `/blog/${months[0].replace("-", "/")}/`,
  );
  await expect(sidebar.locator(".wp-block-categories a")).toHaveText([
    "Allgemein",
    "Erklärung",
    "Kommentar",
    "Newsletter",
    "Reality-Check",
  ]);
});

test("old newsletters: table of contents jumps to its sections, data: images are files", async ({
  page,
}) => {
  await page.goto(bySlug("news-17-anstellungen-vortragsreise").permalink);
  const toc = page.locator("ul.inhalt a");
  await expect(toc.first()).toHaveAttribute("href", "#news_01");
  await toc.nth(2).click();
  await expect(page).toHaveURL(/#news_03$/);
  await expect(page.locator("#news_03")).toBeInViewport();
  await expect(page.locator('img[alt="DEMOCRACY Newsletter Image"]')).toHaveAttribute(
    "src",
    "/blog/wp-content/uploads/inline/news-17-anstellungen-vortragsreise-1.png",
  );
  await expectImagesLoaded(page);
});

test("a post whose featured image was deleted shows the empty frame like live", async ({
  page,
}) => {
  await page.goto(bySlug("democracy-release-23-04-2019").permalink);
  const frame = page.locator("figure.header-image");
  await expect(frame).toHaveCount(1);
  await expect(frame.locator("img")).toHaveCount(0);
  await expect(page.locator("body")).toHaveClass(/has-featured-image/);
});
