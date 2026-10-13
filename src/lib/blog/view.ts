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
import { attachmentImage, ImageLoading, lazySizes } from "./images";
import { renderPostContent } from "./markdown";
import { wptexturize } from "./texturize";

/**
 * What a blog page shows, computed once per page (layout and page share it
 * through React `cache`). Routes: /blog/, /blog/page/<n>/ and the permalinks
 * /blog/<year>/<month>/<slug>/; archives, search and feed follow (TASK-81).
 */

export const ORIGIN = "https://democracy-deutschland.de";

export interface FeaturedImage {
  src: string;
  width: number;
  height: number;
  srcSet: string | null;
  sizes: string;
  fetchPriority?: "high";
  loading?: "lazy";
}

export interface PostView {
  post: BlogPost;
  /** Title as the blog shows it (wptexturize). */
  title: string;
  /** post_class() */
  classes: string[];
  author: BlogTerm;
  categories: BlogTerm[];
  tags: BlogTerm[];
  /** "14. Juni 2026" */
  date: string;
  /** Content (single) or teaser with "Weiterlesen" (index) as HTML. */
  html: string;
  /**
   * Featured image in the size of the view; null when the post has a
   * `_thumbnail_id` whose attachment is gone (WordPress renders an empty
   * frame), undefined without featured image.
   */
  featured: FeaturedImage | null | undefined;
}

export interface PostLink {
  title: string;
  permalink: string;
}

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

export interface IndexView extends ViewBase {
  kind: "index";
  page: number;
  pages: number;
  posts: PostView[];
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
  loading: ImageLoading,
): Promise<FeaturedImage | null | undefined> {
  const { featuredMedia } = post.frontmatter;
  if (!featuredMedia) return undefined;
  const item = (await getBlogMedia()).get(featuredMedia);
  if (!item) return null;
  const image = attachmentImage(item, size);
  const attrs = loading.next(image.width, image.height);
  return { ...image, ...attrs, sizes: lazySizes(image.sizes, attrs.loading) };
}

async function postView(
  post: BlogPost,
  mode: "single" | "teaser",
  loading: ImageLoading,
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
      post,
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

/** Static params of src/app/(blog)/blog/[[...path]]. */
export async function blogStaticParams(): Promise<Array<{ path: string[] }>> {
  const [posts, site] = await Promise.all([getBlogPosts(), getBlogSite()]);
  const pages = Math.max(1, Math.ceil(posts.length / site.postsPerPage));
  return [
    { path: [] },
    ...Array.from({ length: pages - 1 }, (_, index) => ({ path: ["page", String(index + 2)] })),
    ...posts.map((post) => ({ path: post.permalink.split("/").filter(Boolean).slice(1) })),
  ];
}

/** The view for a path below /blog/ ("" = index, "page/2", "2026/06/<slug>"), null if unknown. */
export const getBlogView = cache(async (path: string): Promise<BlogView | null> => {
  const [posts, site] = await Promise.all([getBlogPosts(), getBlogSite()]);
  const pages = Math.max(1, Math.ceil(posts.length / site.postsPerPage));
  const segments = path.split("/").filter(Boolean);

  const pageMatch = segments.length === 0 ? ["", "1"] : /^page\/(\d+)$/.exec(segments.join("/"));
  if (pageMatch) {
    const page = Number(pageMatch[1]);
    if (page < 1 || page > pages || (page === 1 && segments.length > 0)) return null;
    const loading = new ImageLoading();
    const classes = new Set<string>();
    const views: PostView[] = [];
    for (const post of posts.slice((page - 1) * site.postsPerPage, page * site.postsPerPage)) {
      const { view, classes: postClasses } = await postView(post, "teaser", loading);
      views.push(view);
      for (const name of postClasses) classes.add(name);
    }
    return {
      kind: "index",
      page,
      pages,
      posts: views,
      classes,
      // wp_get_document_title(): "Seite" and the number are joined by a no-break space.
      title: page === 1 ? site.title : `${site.title} – Seite\u00a0${page}`,
      bodyClass: [
        "home",
        "blog",
        ...(page > 1 ? ["paged", `paged-${page}`] : []),
        "wp-theme-lovecraft",
      ].join(" "),
    };
  }

  const index = posts.findIndex((post) => post.permalink === `/blog/${segments.join("/")}/`);
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
  months: Array<{ label: string; href: string }>;
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
      label: formatMonth(month),
      href: `/blog/${month.replace("-", "/")}/`,
    })),
    categories: taxonomy.categories
      .filter((term) => used.has(term.slug))
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" })),
  };
});
