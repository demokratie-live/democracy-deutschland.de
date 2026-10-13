import { cache } from "react";
import {
  getBlogMedia,
  getBlogPosts,
  getBlogSite,
  getBlogTaxonomy,
  type BlogPost,
} from "../content/blog";
import type { BlogTerm } from "../schemas/blog";
import { formatMonth, formatPostDate } from "./format";
import { ImageLoading, lazySizes } from "./image-attributes";
import { attachmentImage } from "./images";
import {
  listingBodyClass,
  listingTitle,
  type ArchiveHeading,
  type FeaturedImage,
  type ListingView,
  type PostLink,
  type PostView,
} from "./listing";
import { renderPostContent } from "./markdown";
import { wptexturize } from "./texturize";

/**
 * What a blog page shows, computed once per page (layout and page share it
 * through React `cache`). Routes: /blog/ and /blog/page/<n>/, the archives
 * /blog/category|author|tag/<slug>/, /blog/<year>/ and /blog/<year>/<month>/
 * (each with /page/<n>/), and the permalinks /blog/<year>/<month>/<slug>/.
 * The search (/blog/?s=) renders on the client (BlogSearch).
 */

export const ORIGIN = "https://democracy-deutschland.de";

export type { FeaturedImage, PostLink, PostView } from "./listing";

interface ViewBase {
  /** <title> */
  title: string;
  /** body_class() */
  bodyClass: string;
  /** Classes of the main content, for the block styles in <head>. */
  classes: Set<string>;
}

/**
 * Number of the search widget's input id (`wp-block-search__input-<n>`):
 * WordPress counts wp_unique_id() over the page, and every gallery of the
 * content draws a number before the sidebar.
 */
export function searchInputNumber(classes: Set<string>) {
  return 1 + [...classes].filter((name) => /^wp-block-gallery-\d+$/.test(name)).length;
}

/** A feed link of <head> (feed_links(), feed_links_extra()). */
export interface FeedLink {
  title: string;
  href: string;
}

/** The archive a page shows, marked in the sidebar widgets. */
export interface SidebarCurrent {
  /** Category slug: `current-cat` in the categories widget. */
  category?: string;
  /** "2026-06": `aria-current` in the archives widget. */
  month?: string;
}

export interface IndexView extends ViewBase, ListingView {
  kind: "index";
  /** Feed of the archive, after the blog feed. */
  feed?: FeedLink;
  current?: SidebarCurrent;
}

export interface SingleView extends ViewBase {
  kind: "single";
  post: PostView;
  /** Older post ("Vorheriger"). */
  previous?: PostLink;
  /** Newer post ("Nächster"). */
  next?: PostLink;
}

export type BlogView = IndexView | SingleView;

/** Term class of get_post_class(): the slug, the term ID for numeric slugs ("2021"). */
function termClass(prefix: string, term: BlogTerm) {
  return `${prefix}-${/^[0-9]+$/.test(term.slug) ? term.id : term.slug}`;
}

/** `get_post_class()` of a post (the template adds "post", the single view "post single"). */
function postClasses(post: BlogPost, categories: BlogTerm[], tags: BlogTerm[]) {
  const { wpId, featuredMedia } = post.frontmatter;
  return [
    `post-${wpId}`,
    "type-post",
    "status-publish",
    "format-standard",
    ...(featuredMedia ? ["has-post-thumbnail"] : []),
    "hentry",
    ...categories.map((term) => termClass("category", term)),
    ...tags.map((term) => termClass("tag", term)),
  ];
}

async function featuredImage(
  post: BlogPost,
  size: "post-image" | "post-image-cover",
  loading: ImageLoading | undefined,
): Promise<FeaturedImage | null | undefined> {
  const { featuredMedia } = post.frontmatter;
  if (!featuredMedia) return undefined;
  const item = (await getBlogMedia()).get(featuredMedia);
  if (!item) return null;
  const image = attachmentImage(item, size);
  if (!loading) return image;
  const attrs = loading.next(image.width, image.height);
  return { ...image, ...attrs, sizes: lazySizes(image.sizes, attrs.loading) };
}

/**
 * The view of a post in a list ("teaser") or on its page ("single"). Without
 * `loading`, images get no loading attributes (the client search adds them
 * per result page).
 */
export async function postView(
  post: BlogPost,
  mode: "single" | "teaser",
  loading?: ImageLoading,
): Promise<{ view: PostView; classes: Set<string> }> {
  const taxonomy = await getBlogTaxonomy();
  const { frontmatter } = post;
  // Page order: the featured image comes before the content images.
  const featured = await featuredImage(
    post,
    mode === "single" ? "post-image-cover" : "post-image",
    loading,
  );
  const rendered = renderPostContent(post.content, {
    wpId: frontmatter.wpId,
    permalink: post.permalink,
    mode,
    loading,
  });
  const categories = frontmatter.categories.map(taxonomy.category);
  const tags = frontmatter.tags.map(taxonomy.tag);
  return {
    view: {
      wpId: frontmatter.wpId,
      permalink: post.permalink,
      title: wptexturize(frontmatter.title),
      classes: postClasses(post, categories, tags),
      author: taxonomy.author(frontmatter.author),
      categories,
      tags,
      date: formatPostDate(frontmatter.date),
      html: rendered.html,
      featured,
    },
    classes: rendered.classes,
  };
}

/** A post list: the blog home or an archive, before splitting it into pages. */
interface Listing {
  posts: BlogPost[];
  /** Path of page 1. */
  base: string;
  /** Name in the document title (archives). */
  name?: string;
  heading?: ArchiveHeading;
  /** body_class() before "paged" and of the queried term, see listingBodyClass(). */
  leading: string[];
  term: string[];
  pagedType?: string;
  feed?: FeedLink;
  current?: SidebarCurrent;
}

/**
 * The lists of the blog by their path below /blog/ (without page/<n>/): the
 * home "", category/<slug>, author/<slug>, tag/<slug>, <year>, <year>/<month>.
 * Only terms and dates with posts, like WordPress (else 404).
 */
const getListings = cache(async (): Promise<Map<string, Listing>> => {
  const [posts, site, taxonomy] = await Promise.all([
    getBlogPosts(),
    getBlogSite(),
    getBlogTaxonomy(),
  ]);
  const listings = new Map<string, Listing>();
  listings.set("", { posts, base: "/blog/", leading: ["home", "blog"], term: [] });

  const feedTitle = (label: string) => `${site.title} » ${label}`;
  const archive = (
    path: string,
    filter: (post: BlogPost) => boolean,
    fields: Omit<Listing, "posts" | "base" | "leading" | "term"> &
      Partial<Pick<Listing, "leading" | "term">>,
  ) => {
    const matching = posts.filter(filter);
    if (matching.length === 0) return;
    listings.set(path, {
      posts: matching,
      base: `/blog/${path}/`,
      leading: ["archive"],
      term: [],
      ...fields,
    });
  };

  for (const term of taxonomy.categories) {
    archive(`category/${term.slug}`, (post) => post.frontmatter.categories.includes(term.slug), {
      name: term.name,
      heading: { text: "Kategorie:", name: term.name },
      term: ["category", termClass("category", term), `category-${term.id}`],
      pagedType: "category",
      current: { category: term.slug },
      feed: {
        title: feedTitle(`Kategorie-Feed für ${term.name}`),
        href: `/blog/category/${term.slug}/feed/`,
      },
    });
  }
  for (const term of taxonomy.authors) {
    archive(`author/${term.slug}`, (post) => post.frontmatter.author === term.slug, {
      name: term.name,
      heading: { text: "Autor:", name: term.name },
      term: ["author", `author-${term.slug}`, `author-${term.id}`],
      pagedType: "author",
      feed: {
        title: feedTitle(`Beitrags-Feed von ${term.name}`),
        href: `/blog/author/${term.slug}/feed/`,
      },
    });
  }
  for (const term of taxonomy.tags) {
    archive(`tag/${term.slug}`, (post) => post.frontmatter.tags.includes(term.slug), {
      name: term.name,
      heading: { text: "Schlagwort:", name: term.name },
      term: ["tag", termClass("tag", term), `tag-${term.id}`],
      pagedType: "tag",
      feed: {
        title: feedTitle(`Schlagwort-Feed zu ${term.name}`),
        href: `/blog/tag/${term.slug}/feed/`,
      },
    });
  }
  const dates = new Set(
    posts.flatMap(({ frontmatter }) => [
      frontmatter.date.slice(0, 4),
      frontmatter.date.slice(0, 7),
    ]),
  );
  for (const date of [...dates].sort().reverse()) {
    const name = date.length === 4 ? date : formatMonth(date);
    archive(date.replace("-", "/"), (post) => post.frontmatter.date.startsWith(date), {
      name,
      heading: { text: date.length === 4 ? "Jahr:" : "Monat:", name },
      leading: ["archive", "date"],
      pagedType: "date",
      current: date.length === 7 ? { month: date } : undefined,
    });
  }
  return listings;
});

function pageCount(listing: Listing, postsPerPage: number) {
  return Math.max(1, Math.ceil(listing.posts.length / postsPerPage));
}

/** Static params of src/app/(blog)/blog/[[...path]]. */
export async function blogStaticParams(): Promise<Array<{ path: string[] }>> {
  const [posts, site, listings] = await Promise.all([getBlogPosts(), getBlogSite(), getListings()]);
  const params: Array<{ path: string[] }> = [];
  for (const [path, listing] of listings) {
    const segments = path.split("/").filter(Boolean);
    params.push({ path: segments });
    for (let page = 2; page <= pageCount(listing, site.postsPerPage); page++) {
      params.push({ path: [...segments, "page", String(page)] });
    }
  }
  for (const post of posts) {
    params.push({ path: post.permalink.split("/").filter(Boolean).slice(1) });
  }
  return params;
}

/** The lists that have a feed: the blog ("") and every category, author and tag. */
export async function getFeedListings(): Promise<
  Array<{ path: string; posts: BlogPost[]; name?: string; href: string }>
> {
  const listings = await getListings();
  return [...listings]
    .filter(([path, listing]) => path === "" || listing.feed)
    .map(([path, listing]) => ({
      path,
      posts: listing.posts,
      name: listing.name,
      href: listing.feed?.href ?? "/blog/feed/",
    }));
}

/**
 * The view for a path below /blog/ ("" = home, "page/2", "category/newsletter",
 * "2021/page/2", "2026/06/<slug>"), null if unknown.
 */
export const getBlogView = cache(async (path: string): Promise<BlogView | null> => {
  const [posts, site, listings] = await Promise.all([getBlogPosts(), getBlogSite(), getListings()]);
  const segments = path.split("/").filter(Boolean);

  let page = 1;
  let listPath = segments.join("/");
  const paged = /^(?:(.+)\/)?page\/(\d+)$/.exec(listPath);
  if (paged) {
    // page/1/ redirects to the list itself in WordPress; it has no page here.
    page = Number(paged[2]);
    if (page < 2) return null;
    listPath = paged[1] ?? "";
  }
  const listing = listings.get(listPath);
  if (listing) {
    const pages = pageCount(listing, site.postsPerPage);
    if (page > pages) return null;
    const loading = new ImageLoading();
    const classes = new Set<string>();
    const views: PostView[] = [];
    for (const post of listing.posts.slice(
      (page - 1) * site.postsPerPage,
      page * site.postsPerPage,
    )) {
      const { view, classes: postClasses } = await postView(post, "teaser", loading);
      views.push(view);
      for (const name of postClasses) classes.add(name);
    }
    return {
      kind: "index",
      page,
      pages,
      posts: views,
      base: listing.base,
      heading: listing.heading,
      feed: listing.feed,
      current: listing.current,
      classes,
      title: listing.name
        ? listingTitle(listing.name, page, site.title)
        : // The home: "DEMOCRACY Blog – Seite 2".
          [site.title, ...(page > 1 ? [`Seite\u00a0${page}`] : [])].join(" – "),
      bodyClass: listingBodyClass(listing.leading, listing.term, page, listing.pagedType),
    };
  }
  if (paged) return null;

  const index = posts.findIndex((post) => post.permalink === `/blog/${listPath}/`);
  if (index < 0) return null;
  const post = posts[index];
  const { view, classes } = await postView(post, "single", new ImageLoading());
  const link = (other: BlogPost | undefined) =>
    other && { title: wptexturize(other.frontmatter.title), permalink: other.permalink };
  return {
    kind: "single",
    post: view,
    previous: link(posts[index + 1]),
    next: link(posts[index - 1]),
    classes,
    title: `${view.title} – ${site.title}`,
    bodyClass: [
      "wp-singular",
      "post-template-default",
      "single",
      "single-post",
      `postid-${post.frontmatter.wpId}`,
      "single-format-standard",
      "wp-theme-lovecraft",
      ...(post.frontmatter.featuredMedia ? ["has-featured-image"] : []),
    ].join(" "),
  };
});

export interface SidebarData {
  latest: PostLink[];
  months: Array<{ month: string; label: string; href: string }>;
  categories: BlogTerm[];
}

/** Widgets: newest posts, monthly archives, categories with posts (by name). */
export const getSidebarData = cache(async (): Promise<SidebarData> => {
  const [posts, site, taxonomy] = await Promise.all([
    getBlogPosts(),
    getBlogSite(),
    getBlogTaxonomy(),
  ]);
  const months = [...new Set(posts.map((post) => post.frontmatter.date.slice(0, 7)))];
  const used = new Set(posts.flatMap((post) => post.frontmatter.categories));
  return {
    latest: posts.slice(0, site.latestPosts).map((post) => ({
      title: wptexturize(post.frontmatter.title),
      permalink: post.permalink,
    })),
    months: months.map((month) => ({
      month,
      label: formatMonth(month),
      href: `/blog/${month.replace("-", "/")}/`,
    })),
    categories: taxonomy.categories
      .filter((term) => used.has(term.slug))
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" })),
  };
});
