import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";
import { getBlogPosts, getBlogSite, type BlogPost } from "../content/blog";
import { EXCERPT_REMOVED_BLOCKS, type PostView } from "./listing";
import { markdownToHast } from "./markdown";
import { BLOCK_STYLE_ORDER, blockStyleCss, SIDEBAR_BLOCKS } from "./styles";
import { ORIGIN, postView } from "./view";

/**
 * /blog/search-index.json: everything the client search (BlogSearch) needs.
 * Built once per export and loaded only when somebody searches.
 */

export interface SearchIndexPost {
  id: number;
  /** post_date (local), orders equal ranks. */
  date: string;
  /** post_title as stored. */
  title: string;
  /** The content as WordPress searches it, see searchContent(). */
  content: string;
  /**
   * The post in the results: Lovecraft shows the_excerpt() there instead of
   * the teaser. Without loading attributes (they depend on the page).
   */
  view: PostView;
  /**
   * Blocks with an inline style (`wp-block-<name>-inline-css`) that the
   * excerpt renders: wp_trim_excerpt() renders the allowed blocks of the
   * teaser, which enqueues their styles, and strips the markup afterwards.
   */
  blocks: string[];
}

export interface SearchIndex {
  title: string;
  postsPerPage: number;
  posts: SearchIndexPost[];
  /** Block styles teasers may need beyond the sidebar ones. */
  styles: Array<{ name: string; css: string }>;
  /** Order of all block styles in <head> (src/lib/blog/styles.ts). */
  styleOrder: string[];
}

/**
 * post_content as WordPress stores it, as close as the Markdown allows:
 * the rendered HTML with absolute upload URLs, `&nbsp;` entities, without
 * the attributes WordPress adds only when rendering (srcset, sizes,
 * decoding), and `data:` images (now files, docs/abweichungen.md) as an
 * empty data URI. The search matches markup too, like LIKE '%…%' in MySQL.
 */
export function searchContent(post: BlogPost): string {
  const tree = markdownToHast(post.content);
  visit(tree, "element", (node) => {
    const props = node.properties;
    delete props.srcSet;
    delete props.sizes;
    delete props.decoding;
    for (const key of ["src", "href"] as const) {
      const value = props[key];
      if (typeof value !== "string") continue;
      const inline = /^\/blog\/wp-content\/uploads\/inline\/[^/]+\.(\w+)$/.exec(value);
      if (inline) props[key] = `data:image/${inline[1]};base64,`;
      else if (value.startsWith("/blog/")) props[key] = `${ORIGIN}${value}`;
    }
  });
  return toHtml(tree).replace(/ /g, "&nbsp;");
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function buildSearchIndex(): Promise<SearchIndex> {
  const [posts, site] = await Promise.all([getBlogPosts(), getBlogSite()]);
  const entries: SearchIndexPost[] = [];
  const used = new Set<string>();
  for (const post of posts) {
    const { view, classes } = await postView(post, "teaser");
    if ([...classes].some((name) => /^wp-block-gallery-\d+$/.test(name))) {
      // Galleries change the search widget id and need core-block-supports;
      // BlogSearch does not handle them.
      throw new Error(`Galerie im Teaser von ${post.permalink}: BlogSearch erweitern`);
    }
    const blocks = BLOCK_STYLE_ORDER.filter(
      (name) =>
        !SIDEBAR_BLOCKS.has(name) &&
        !EXCERPT_REMOVED_BLOCKS.includes(name) &&
        classes.has(`wp-block-${name}`),
    );
    for (const name of blocks) used.add(name);
    entries.push({
      id: post.frontmatter.wpId,
      date: post.frontmatter.date,
      title: post.frontmatter.title,
      content: searchContent(post),
      view: { ...view, html: `<p>${escapeHtml(post.frontmatter.excerpt)}</p>` },
      blocks,
    });
  }
  const styles = await Promise.all(
    BLOCK_STYLE_ORDER.filter((name) => used.has(name)).map(async (name) => ({
      name,
      css: await blockStyleCss(name),
    })),
  );
  return {
    title: site.title,
    postsPerPage: site.postsPerPage,
    posts: entries,
    styles,
    styleOrder: BLOCK_STYLE_ORDER,
  };
}
