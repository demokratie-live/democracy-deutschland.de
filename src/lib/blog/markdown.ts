import type { Element, Root } from "hast";
import { toHtml } from "hast-util-to-html";
import rehypeRaw from "rehype-raw";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { BASE_PATH } from "../base-path";
import { ImageLoading, lazySizes, mapSrcSet } from "./image-attributes";

export { mapSrcSet };

/**
 * Post content: content/blog/<slug>.md is CommonMark with inline HTML, written
 * by scripts/import-blog.ts. Markdown stands where it yields exactly the DOM
 * of WordPress, HTML everywhere else. This pipeline turns it back into the
 * HTML WordPress renders.
 */

/** Classes the block editor gives the elements Markdown produces. */
const BLOCK_CLASSES: Record<string, string> = {
  p: "wp-block-paragraph",
  h1: "wp-block-heading",
  h2: "wp-block-heading",
  h3: "wp-block-heading",
  h4: "wp-block-heading",
  h5: "wp-block-heading",
  h6: "wp-block-heading",
  ul: "wp-block-list",
  ol: "wp-block-list",
};

/** Before rehype-raw: only elements from Markdown are elements, HTML is still `raw`. */
function rehypeBlockClasses() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      const className = BLOCK_CLASSES[node.tagName];
      if (className) node.properties.className = [className];
    });
  };
}

/** Markdown → hast with WordPress block classes, HTML parsed like a browser does. */
export function markdownToHast(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeBlockClasses)
    .use(rehypeRaw);
  return processor.runSync(processor.parse(markdown)) as Root;
}

export interface RenderOptions {
  wpId: number;
  /** Permalink of the post (more link of the teaser). */
  permalink: string;
  /**
   * "single": the whole post, `<!--more-->` becomes `<span id="more-<id>">`.
   * "teaser": the part before `<!--more-->` plus the "Weiterlesen" link, as
   * on the blog index.
   */
  mode: "single" | "teaser";
  /** Loading attributes are counted over the whole page; none without. */
  loading?: ImageLoading;
  /**
   * Prefix of root-relative URLs (uploads, links): the basePath by default,
   * the origin of the live site in the feeds.
   */
  urlPrefix?: string;
}

export interface RenderedContent {
  html: string;
  /** Every class in the output: the block styles in <head> depend on `wp-block-<name>`. */
  classes: Set<string>;
}

function isMoreComment(node: Root["children"][number]) {
  return node.type === "comment" && node.value.trim() === "more";
}

function moreSpan(wpId: number): Element {
  return {
    type: "element",
    tagName: "span",
    properties: { id: `more-${wpId}` },
    children: [],
  };
}

function moreLink(permalink: string): Element {
  return {
    type: "element",
    tagName: "p",
    properties: { className: ["more-link-wrapper"] },
    children: [
      {
        type: "element",
        tagName: "a",
        properties: { className: ["more-link", "faux-button"], href: permalink },
        children: [{ type: "text", value: "Weiterlesen" }],
      },
    ],
  };
}

/** Post content as HTML for `dangerouslySetInnerHTML`, as WordPress outputs it. */
export function renderPostContent(markdown: string, options: RenderOptions): RenderedContent {
  const tree = markdownToHast(markdown);

  const moreIndex = tree.children.findIndex(isMoreComment);
  if (options.mode === "single") {
    if (moreIndex >= 0) tree.children[moreIndex] = moreSpan(options.wpId);
  } else if (moreIndex >= 0) {
    tree.children = [...tree.children.slice(0, moreIndex), moreLink(options.permalink)];
  }

  const prefix = options.urlPrefix ?? BASE_PATH;
  const withPrefix = (url: string) =>
    url.startsWith("/") && !url.startsWith("//") ? `${prefix}${url}` : url;
  const classes = new Set<string>();
  visit(tree, "element", (node) => {
    const props = node.properties;
    for (const name of (props.className as string[] | undefined) ?? []) classes.add(name);
    if (node.tagName === "img" && options.loading) {
      const attrs = options.loading.next(Number(props.width) || 0, Number(props.height) || 0);
      Object.assign(props, attrs);
      if (typeof props.sizes === "string") props.sizes = lazySizes(props.sizes, attrs.loading);
    }
    for (const key of ["src", "href"] as const) {
      if (typeof props[key] === "string") props[key] = withPrefix(props[key]);
    }
    if (props.srcSet) props.srcSet = mapSrcSet(props.srcSet, withPrefix);
  });
  return { html: toHtml(tree), classes };
}
