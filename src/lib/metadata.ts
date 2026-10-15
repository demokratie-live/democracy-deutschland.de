import type { Metadata } from "next";
import { asset } from "./base-path";
import { getHead } from "./content";
import type { PageFrontmatter } from "./schemas";

/** Head data of content/site/head.yaml, overridden by a page's frontmatter. */
export async function buildMetadata(page?: PageFrontmatter): Promise<Metadata> {
  const head = await getHead();
  const title = page?.title ?? head.title;
  const meta = { ...head.meta, ...page?.meta };

  // Names with their own Metadata field; everything else goes to `other`.
  const {
    author,
    publisher,
    description,
    keywords,
    robots,
    "theme-color": _themeColor,
    ...other
  } = meta;
  void _themeColor; // rendered through `viewport` in the root layout

  return {
    title,
    description,
    keywords,
    authors: author ? [{ name: author }] : undefined,
    publisher,
    robots,
    other,
    // No `openGraph` here: Next would derive twitter:* tags from it, which the
    // live site does not have. OpenGraphTags renders og:* instead.
    manifest: asset(head.manifest),
    icons: {
      icon: head.icons
        .filter((icon) => icon.rel === "icon")
        .map(({ href, sizes, type }) => ({ url: asset(href), sizes, type })),
      apple: head.icons
        .filter((icon) => icon.rel === "apple-touch-icon")
        .map(({ href, sizes }) => ({ url: asset(href), sizes })),
    },
  };
}

/** og:* tags as [property, content] in live order (og:title = page title). */
export async function openGraphTags(page?: PageFrontmatter): Promise<Array<[string, string]>> {
  const head = await getHead();
  const openGraph = { ...head.openGraph, ...page?.openGraph };
  return [
    ["og:url", openGraph.url],
    ["og:type", openGraph.type],
    ["og:title", page?.title ?? head.title],
    ["og:description", openGraph.description],
    ["og:image", openGraph.image],
  ];
}
