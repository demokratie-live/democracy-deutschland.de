import { expect, test } from "@playwright/test";
import { formatMonth } from "../../src/lib/blog/format";
import {
  getBlogPosts,
  getBlogSite,
  getBlogTaxonomy,
  type BlogPost,
} from "../../src/lib/content/blog";
import { contentYaml, trackErrors } from "./helpers";

// Expected values come from content/blog/ (the import), never from live.
let posts: BlogPost[];
let perPage: number;
let perFeed: number;

test.beforeAll(async () => {
  posts = await getBlogPosts();
  const site = await getBlogSite();
  perPage = site.postsPerPage;
  perFeed = site.postsPerFeed;
});

/** Console errors without the uploads that already answer 404 on live (content/blog/missing-uploads.yaml). */
const missing = new Set(contentYaml<string[]>("blog/missing-uploads.yaml"));
const ownErrors = (errors: string[]) =>
  errors.filter((error) => {
    const url = /\((http:\/\/localhost[^)]+)\)$/.exec(error)?.[1];
    return !(url && missing.has(decodeURI(new URL(url).pathname)));
  });

const pageCount = (list: BlogPost[]) => Math.ceil(list.length / perPage);
const pageUrl = (base: string, page: number) => (page === 1 ? base : `${base}page/${page}/`);

/** Every archive WordPress has for the posts: path → posts, newest first. */
async function archives() {
  const taxonomy = await getBlogTaxonomy();
  const lists = new Map<string, BlogPost[]>();
  const add = (base: string, list: BlogPost[]) => list.length && lists.set(base, list);
  for (const term of taxonomy.categories) {
    add(
      `/blog/category/${term.slug}/`,
      posts.filter((p) => p.frontmatter.categories.includes(term.slug)),
    );
  }
  for (const term of taxonomy.authors) {
    add(
      `/blog/author/${term.slug}/`,
      posts.filter((p) => p.frontmatter.author === term.slug),
    );
  }
  for (const term of taxonomy.tags) {
    add(
      `/blog/tag/${term.slug}/`,
      posts.filter((p) => p.frontmatter.tags.includes(term.slug)),
    );
  }
  for (const date of new Set(
    posts.flatMap((p) => [p.frontmatter.date.slice(0, 4), p.frontmatter.date.slice(0, 7)]),
  )) {
    add(
      `/blog/${date.replace("-", "/")}/`,
      posts.filter((p) => p.frontmatter.date.startsWith(date)),
    );
  }
  return lists;
}

test("every archive page and every archive feed is exported", async ({ request }) => {
  const lists = await archives();
  // 5 categories, 3 authors, 25 tags, months and years with posts.
  expect(lists.size).toBeGreaterThan(60);
  for (const [base, list] of lists) {
    for (let page = 1; page <= pageCount(list); page++) {
      expect((await request.get(pageUrl(base, page))).status(), pageUrl(base, page)).toBe(200);
    }
    expect((await request.get(`${base}page/${pageCount(list) + 1}/`)).status()).toBe(404);
    if (/\/(category|author|tag)\//.test(base)) {
      const feed = await request.get(`${base}feed/`);
      expect(feed.status(), `${base}feed/`).toBe(200);
      expect(await feed.text()).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?><rss/);
    }
  }
  // Day archives are not built (docs/abweichungen.md).
  expect((await request.get("/blog/2021/08/09/")).status()).toBe(404);
});

test("category archive: header with page count, the category's posts, page links", async ({
  page,
}) => {
  const errors = trackErrors(page);
  const newsletter = posts.filter((p) => p.frontmatter.categories.includes("newsletter"));
  const pages = pageCount(newsletter);
  await page.goto("/blog/category/newsletter/");
  await expect(page).toHaveTitle("Newsletter – DEMOCRACY Blog");
  await expect(page.locator("body")).toHaveAttribute(
    "class",
    "archive category category-newsletter category-2 wp-theme-lovecraft",
  );
  await expect(page.locator(".archive-title")).toHaveText(
    `Kategorie: Newsletter Seite 1 von ${pages}`,
  );
  await expect(page.locator("div.blog-title")).toHaveCount(1);
  await expect(page.locator("#posts > .post")).toHaveCount(perPage);
  await expect(page.locator("#posts > .post").first()).toHaveAttribute(
    "id",
    `post-${newsletter[0].frontmatter.wpId}`,
  );
  await expect(
    page.locator('head link[title="DEMOCRACY Blog » Kategorie-Feed für Newsletter"]'),
  ).toHaveAttribute("href", "/blog/category/newsletter/feed/");
  const current = page.locator(".wp-block-categories li.current-cat a");
  await expect(current).toHaveText("Newsletter");
  await expect(current).toHaveAttribute("aria-current", "page");

  await page.locator(".archive-navigation a", { hasText: "Nächster" }).click();
  await expect(page).toHaveURL("/blog/category/newsletter/page/2/");
  await expect(page).toHaveTitle("Newsletter – Seite 2 – DEMOCRACY Blog");
  await expect(page.locator("body")).toHaveClass(/paged-2 category-paged-2/);

  // The last page names no page count in the header (Lovecraft).
  await page.goto(`/blog/category/newsletter/page/${pages}/`);
  await expect(page.locator(".archive-title")).toHaveText("Kategorie: Newsletter");
  await expect(page.locator(".archive-navigation .fleft")).toHaveText(
    `Seite ${pages} von ${pages}`,
  );
  expect(ownErrors(errors)).toEqual([]);
});

test("author, tag, month and year archives", async ({ page }) => {
  await page.goto("/blog/author/timo/");
  await expect(page).toHaveTitle("Timo Sieg – DEMOCRACY Blog");
  await expect(page.locator(".archive-title")).toContainText("Autor: Timo Sieg");
  await expect(page.locator(".post-author a").first()).toHaveText("Timo Sieg");

  await page.goto("/blog/tag/2021/");
  await expect(page.locator("body")).toHaveAttribute(
    "class",
    "archive tag tag-7 wp-theme-lovecraft",
  );
  await expect(page.locator(".archive-title")).toHaveText("Schlagwort: 2021");

  const month = posts[0].frontmatter.date.slice(0, 7);
  await page.goto(`/blog/${month.replace("-", "/")}/`);
  await expect(page.locator(".archive-title")).toHaveText(`Monat: ${formatMonth(month)}`);
  await expect(page.locator(".wp-block-archives a[aria-current='page']")).toHaveText(
    formatMonth(month),
  );
  await expect(page.locator("head link[type='application/rss+xml']")).toHaveCount(1);

  const year = posts.filter((p) => p.frontmatter.date.startsWith("2021"));
  await page.goto("/blog/2021/");
  await expect(page.locator(".archive-title")).toHaveText(
    `Jahr: 2021 Seite 1 von ${pageCount(year)}`,
  );
  await expect(page.locator(".wp-block-archives a[aria-current]")).toHaveCount(0);
});

test("links of a post lead to its archives", async ({ page }) => {
  const post = posts.find(
    (p) => p.frontmatter.slug === "in-luetzerath-verlaeuft-die-demokratiegrenze",
  )!;
  await page.goto(post.permalink);
  await page.locator(".post-categories a").first().click();
  await expect(page).toHaveURL("/blog/category/kommentar/");
  await page.goto(post.permalink);
  await page.locator(".post-author a").click();
  await expect(page).toHaveURL("/blog/author/timo/");
  await page.goto(post.permalink);
  await page.locator(".post-tags a", { hasText: "Räumung" }).click();
  await expect(page).toHaveURL("/blog/tag/raeumung/");
  await expect(page.locator("#posts > .post")).toHaveCount(1);
});

test("feeds: valid RSS 2.0 with the newest posts, guid and categories", async ({
  page,
  request,
}) => {
  await page.goto("/blog/");
  for (const [url, list] of [
    ["/blog/feed/", posts],
    [
      "/blog/category/kommentar/feed/",
      posts.filter((p) => p.frontmatter.categories.includes("kommentar")),
    ],
  ] as const) {
    const xml = await (await request.get(url)).text();
    const feed = await page.evaluate((text) => {
      const doc = new DOMParser().parseFromString(text, "application/xml");
      const items = [...doc.querySelectorAll("item")];
      return {
        error: doc.querySelector("parsererror")?.textContent ?? null,
        self: doc.querySelector("channel > *|link[rel=self]")?.getAttribute("href"),
        links: items.map((item) => item.querySelector("link")?.textContent),
        guids: items.map((item) => item.querySelector("guid")?.textContent),
        content: items[0]?.getElementsByTagName("content:encoded")[0]?.textContent ?? "",
      };
    }, xml);
    expect(feed.error).toBeNull();
    expect(feed.self).toBe(`https://democracy-deutschland.de${url}`);
    const expected = list.slice(0, perFeed);
    expect(feed.links).toEqual(
      expected.map((p) => `https://democracy-deutschland.de${p.permalink}`),
    );
    expect(feed.guids).toEqual(expected.map((p) => p.frontmatter.guid));
    expect(feed.content).toContain(`<span id="more-${expected[0].frontmatter.wpId}"></span>`);
    expect(feed.content).not.toMatch(/(src|href)="\/blog\//);
  }
});

test("short links forward to the permalink like WordPress, unknown ids to the 404 page", async ({
  page,
}) => {
  const post = posts[3];
  await page.goto(`/blog/?p=${post.frontmatter.wpId}`);
  await expect(page).toHaveURL(post.permalink);
  await page.goto(`/blog/?post_type=post&p=${post.frontmatter.wpId}#more-${post.frontmatter.wpId}`);
  await expect(page).toHaveURL(`${post.permalink}#more-${post.frontmatter.wpId}`);
  await page.goto("/blog/?p=999999");
  await expect(page).toHaveURL("/404/");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});
