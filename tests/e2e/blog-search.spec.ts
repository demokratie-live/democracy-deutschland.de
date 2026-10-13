import { expect, test, type Page } from "@playwright/test";
import { prepareSearch, searchPosts } from "../../src/lib/blog/search";
import { buildSearchIndex, type SearchIndex } from "../../src/lib/blog/search-index";
import { getBlogPosts, type BlogPost } from "../../src/lib/content/blog";
import { trackErrors } from "./helpers";

// Expected results come from the search of src/lib/blog/search.ts over
// content/blog/ (checked against live by pnpm compare-blog-search).
let index: SearchIndex;
let posts: BlogPost[];
let find: (s: string) => number[];

test.beforeAll(async () => {
  [index, posts] = await Promise.all([buildSearchIndex(), getBlogPosts()]);
  const prepared = prepareSearch(index.posts.map((post) => ({ ...post, excerpt: "" })));
  find = (s) => searchPosts(prepared, s);
});

async function waitForResults(page: Page) {
  await page.waitForFunction(() => document.body.classList.contains("search"));
}

const ids = (page: Page) =>
  page
    .locator("#posts > .post")
    .evaluateAll((entries) => entries.map((entry) => Number(entry.id.slice(5))));

test("the sidebar widget searches without server; results page like WordPress", async ({
  page,
}) => {
  const errors = trackErrors(page);
  const term = "bundestag abstimmung";
  const expected = find(term);
  const pages = Math.ceil(expected.length / index.postsPerPage);
  expect(pages).toBeGreaterThan(1);

  await page.goto("/blog/");
  await page.locator(".sidebar .wp-block-search__input").fill(term);
  await page.locator(".sidebar .wp-block-search__button").click();
  await expect(page).toHaveURL("/blog/?s=bundestag+abstimmung");
  await waitForResults(page);
  await expect(page).toHaveTitle(`Suchergebnisse für „${term}“ – DEMOCRACY Blog`);
  await expect(page.locator("body")).toHaveAttribute(
    "class",
    "search search-results wp-theme-lovecraft",
  );
  await expect(page.locator(".archive-title")).toHaveText(
    `Suchergebnisse: „${term}“ Seite 1 von ${pages}`,
  );
  expect(await ids(page)).toEqual(expected.slice(0, index.postsPerPage));
  // Results show the excerpt (the_excerpt()), not the teaser with "Weiterlesen".
  const first = posts.find((post) => post.frontmatter.wpId === expected[0])!;
  await expect(page.locator("#posts .post-content").first()).toHaveText(first.frontmatter.excerpt);
  await expect(page.locator("#posts .more-link")).toHaveCount(0);
  await expect(page.locator("div.blog-title")).toHaveCount(1);
  await expect(page.locator(".sidebar .wp-block-search__input")).toHaveValue(term);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow, max-image-preview:large",
  );
  await expect(page.locator("#site-content .content")).toBeVisible();

  await page.locator(".archive-navigation a", { hasText: "Nächster" }).click();
  await expect(page).toHaveURL("/blog/page/2/?s=bundestag+abstimmung");
  await waitForResults(page);
  await expect(page).toHaveTitle(`Suchergebnisse für „${term}“ – Seite 2 – DEMOCRACY Blog`);
  await expect(page.locator("body")).toHaveClass(/paged-2 search-paged-2/);
  expect(await ids(page)).toEqual(expected.slice(index.postsPerPage, 2 * index.postsPerPage));
  await expect(page.locator(".archive-navigation a", { hasText: "Vorheriger" })).toHaveAttribute(
    "href",
    "/blog/?s=bundestag+abstimmung",
  );
  expect(errors).toEqual([]);
});

test("direct links: umlauts, title matches first, images with loading attributes", async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto("/blog/?s=gr%C3%BCnen");
  await waitForResults(page);
  expect(await ids(page)).toEqual(find("grünen").slice(0, index.postsPerPage));
  // The first large image of the page gets fetchpriority, later ones load lazily.
  const images = page.locator("#posts img");
  await expect(images.first()).toHaveAttribute("fetchpriority", "high");
  await expect(images.nth(3)).toHaveAttribute("loading", "lazy");
  await expect(images.nth(3)).toHaveAttribute("sizes", /^auto, /);
  expect(errors).toEqual([]);
});

test("no results: message and search form, no paragraph styles", async ({ page }) => {
  await page.goto("/blog/?s=xyzxyzq");
  await waitForResults(page);
  await expect(page.locator("body")).toHaveAttribute(
    "class",
    "search search-no-results wp-theme-lovecraft",
  );
  await expect(page.locator(".archive-title")).toHaveText("Suchergebnisse: „xyzxyzq“");
  await expect(page.locator("article.post.single .post-content p")).toHaveText(
    "Nichts gefunden; möchtest du noch einmal probieren?",
  );
  await expect(page.locator("#wp-block-paragraph-inline-css")).toHaveCount(0);
  await page.locator("article .search-field").fill("weihnachten");
  await page.locator("article .search-button").click();
  await expect(page).toHaveURL("/blog/?s=weihnachten");
  await waitForResults(page);
  expect(await ids(page)).toEqual(find("weihnachten"));
  await expect(page.locator("#wp-block-paragraph-inline-css")).toHaveCount(1);
});

test("an empty search lists every post; page links keep ?s without value", async ({ page }) => {
  await page.goto("/blog/?s=");
  await waitForResults(page);
  await expect(page.locator(".archive-title")).toContainText("Suchergebnisse: „“");
  expect(await ids(page)).toEqual(
    posts.slice(0, index.postsPerPage).map((p) => p.frontmatter.wpId),
  );
  await expect(page.locator(".archive-navigation a", { hasText: "Nächster" })).toHaveAttribute(
    "href",
    "/blog/page/2/?s",
  );
});

test("a search page beyond the last one ends on the 404 page", async ({ page }) => {
  await page.goto("/blog/page/5/?s=weihnachten");
  await expect(page).toHaveURL("/404/");
});

test("archive pages ignore ?s= (no server, docs/abweichungen.md)", async ({ page }) => {
  await page.goto("/blog/category/newsletter/?s=wahl");
  await expect(page.locator(".archive-title")).toContainText("Kategorie: Newsletter");
  await expect(page.locator("body")).not.toHaveClass(/search/);
});
