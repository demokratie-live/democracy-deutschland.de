"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { asset } from "@/lib/base-path";
import { applyImageLoading, ImageLoading, lazySizes } from "@/lib/blog/image-attributes";
import {
  listingBodyClass,
  listingTitle,
  type ListingView,
  type PostView,
} from "@/lib/blog/listing";
import { prepareSearch, SEARCH_PENDING_SHEET, searchPosts, searchQuery } from "@/lib/blog/search";
import type { SearchIndex } from "@/lib/blog/search-index";
import { useBlogSearchQuery } from "@/lib/blog/search-query";
import { BlogIndex } from "./BlogIndex";

let indexRequest: Promise<{ index: SearchIndex; prepared: ReturnType<typeof prepareSearch> }>;

function loadIndex() {
  indexRequest ??= fetch(asset("/blog/search-index.json"))
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} search-index.json`);
      return response.json() as Promise<SearchIndex>;
    })
    .then((index) => ({
      index,
      prepared: prepareSearch(index.posts.map((post) => ({ ...post, excerpt: "" }))),
    }));
  return indexRequest;
}

interface Result {
  /** Results of the page, or null for "Nichts gefunden". */
  view: ListingView | null;
  title: string;
  bodyClass: string;
  /** Block styles the page needs in <head>. */
  blocks: Set<string>;
  index: SearchIndex;
}

/** Shows the content column the head script has hidden. */
function revealContent() {
  const sheet = (window as unknown as Record<string, CSSStyleSheet | undefined>)[
    SEARCH_PENDING_SHEET
  ];
  if (sheet) document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
}

/** Featured image and content images of the page get their loading attributes in page order. */
function withLoading(view: PostView, loading: ImageLoading): PostView {
  let featured = view.featured;
  if (featured) {
    const attrs = loading.next(featured.width, featured.height);
    featured = { ...featured, ...attrs, sizes: lazySizes(featured.sizes, attrs.loading) };
  }
  return { ...view, featured, html: applyImageLoading(view.html, loading) };
}

/** Adds and removes `wp-block-<name>-inline-css` so <head> holds the styles of the page. */
function syncBlockStyles(index: SearchIndex, blocks: Set<string>) {
  const known = new Map(index.styles.map((style) => [style.name, style.css]));
  for (const [position, name] of index.styleOrder.entries()) {
    if (!known.has(name)) continue;
    const id = `wp-block-${name}-inline-css`;
    const existing = document.getElementById(id);
    if (!blocks.has(name)) {
      existing?.remove();
      continue;
    }
    if (existing) continue;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = known.get(name) ?? "";
    // Before the next block style of the head order, else before the classic theme styles.
    const next = index.styleOrder
      .slice(position + 1)
      .map((other) => document.getElementById(`wp-block-${other}-inline-css`))
      .find(Boolean);
    const anchor = next ?? document.getElementById("classic-theme-styles-inline-css");
    document.head.insertBefore(style, anchor);
  }
}

/** The search results page of Lovecraft when nothing matches (searchform.php inside). */
function NoResults({ query }: { query: string }) {
  return (
    <>
      <div className="archive-header">
        <h1 className="archive-title">Suchergebnisse: „{query}“</h1>
      </div>
      <article className="post single">
        <div className="post-inner">
          <div className="post-content">
            <p>Nichts gefunden; möchtest du noch einmal probieren?</p>
            <form method="get" className="search-form" id="search-form-2" action={asset("/blog/")}>
              <input
                type="search"
                className="search-field"
                placeholder="Suchformular"
                name="s"
                id="s-2"
              />{" "}
              <button type="submit" className="search-button">
                <div className="genericon genericon-search"></div>
                <span className="screen-reader-text">Suchen</span>
              </button>
            </form>
          </div>
        </div>
      </article>
    </>
  );
}

/**
 * The WordPress search without server: on /blog/ and /blog/page/<n>/ with
 * `?s=` the content column shows the results of page `page` instead of the
 * posts, and the document gets title, body class, block styles and the
 * search field value of the live results page. The head script hides the
 * column until then (BlogQueryScript).
 */
export function BlogSearch({ page, children }: { page: number; children: ReactNode }) {
  const query = useBlogSearchQuery();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (query === null) return;
    let active = true;
    loadIndex()
      .then(({ index, prepared }) => {
        if (!active) return;
        const ids = searchPosts(prepared, query);
        const pages = Math.ceil(ids.length / index.postsPerPage);
        if (page > Math.max(1, pages)) {
          // WordPress answers a search page beyond the last one with 404.
          window.location.replace(asset("/404/"));
          return;
        }
        const byId = new Map(index.posts.map((post) => [post.id, post]));
        const shown = ids
          .slice((page - 1) * index.postsPerPage, page * index.postsPerPage)
          .map((id) => byId.get(id)!);
        const loading = new ImageLoading();
        const name = `Suchergebnisse für „${query}“`;
        setResult({
          index,
          view: shown.length
            ? {
                page,
                pages,
                posts: shown.map((post) => withLoading(post.view, loading)),
                base: "/blog/",
                query: searchQuery(query),
                heading: { text: `Suchergebnisse: „${query}“` },
              }
            : null,
          title: listingTitle(name, page, index.title),
          bodyClass: listingBodyClass(
            ["search", shown.length ? "search-results" : "search-no-results"],
            [],
            page,
            "search",
          ),
          blocks: new Set(shown.flatMap((post) => post.blocks)),
        });
      })
      .catch((error: unknown) => {
        // Without the index the page stays the post list.
        console.warn("Blog-Suche nicht verfügbar:", error);
        revealContent();
      });
    return () => {
      active = false;
    };
  }, [query, page]);

  useLayoutEffect(() => {
    if (!result || query === null) return;
    document.title = result.title;
    document.body.className = result.bodyClass;
    syncBlockStyles(result.index, result.blocks);
    // The search widget shows the term (get_search_query()).
    const field = document.querySelector<HTMLInputElement>(".sidebar .wp-block-search__input");
    if (field) {
      field.value = query;
      field.setAttribute("value", query);
    }
    revealContent();
  }, [result, query]);

  if (query === null || !result) return children;
  return result.view ? <BlogIndex view={result.view} /> : <NoResults query={query} />;
}
