import type { BlogTerm } from "../schemas/blog";

/**
 * View data of the blog pages and the rules WordPress uses for post lists
 * (home, archives, search). No server dependencies: the static pages
 * (src/lib/blog/view.ts) and the client search share it.
 */

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
  wpId: number;
  /** /blog/<year>/<month>/<slug>/ */
  permalink: string;
  /** Title as the blog shows it (wptexturize). */
  title: string;
  /** post_class() */
  classes: string[];
  author: BlogTerm;
  categories: BlogTerm[];
  tags: BlogTerm[];
  /** "14. Juni 2026" */
  date: string;
  /** Content (single) or teaser with "Weiterlesen" (lists) as HTML. */
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

/** archive-header of Lovecraft: get_the_archive_title(), or the search title. */
export interface ArchiveHeading {
  /** "Kategorie:" (archives) or the whole title (search: "Suchergebnisse: „…“"). */
  text: string;
  /** Archive name, rendered in a <span> after the text. */
  name?: string;
}

/** One page of a post list: the blog home, an archive or search results. */
export interface ListingView {
  page: number;
  pages: number;
  posts: PostView[];
  /** Path of page 1 ("/blog/", "/blog/category/newsletter/"). */
  base: string;
  /** Query string of the page links (search: "?s=wahl"). */
  query?: string;
  /** Archives and search; the blog home has none. */
  heading?: ArchiveHeading;
}

/** Link of page `page` of a list: page 1 is the base, then <base>page/<n>/. */
export function pageHref(base: string, page: number, query = "") {
  return `${page === 1 ? base : `${base}page/${page}/`}${query}`;
}

/**
 * body_class() of a list page: `leading` are the classes before "paged"
 * ("home blog", "archive date", "search search-results"), `term` those of
 * the queried author, category or tag, `pagedType` the type of the
 * "<type>-paged-<n>" class (none on the blog home).
 */
export function listingBodyClass(
  leading: string[],
  term: string[],
  page: number,
  pagedType?: string,
): string {
  const paged = page > 1;
  // body_class() drops duplicates ("tag-7 tag-7" for the numeric slug "2021").
  const classes = new Set([
    ...leading,
    ...(paged ? ["paged"] : []),
    ...term,
    ...(paged ? [`paged-${page}`] : []),
    ...(paged && pagedType ? [`${pagedType}-paged-${page}`] : []),
    "wp-theme-lovecraft",
  ]);
  return [...classes].join(" ");
}

/**
 * wp_get_document_title() of a list page: "<name> – Seite <n> – <site>";
 * "Seite" and the number are joined by a no-break space.
 */
export function listingTitle(name: string, page: number, site: string) {
  return [name, ...(page > 1 ? [`Seite ${page}`] : []), site].join(" – ");
}
