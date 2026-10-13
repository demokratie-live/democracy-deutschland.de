import { getBlogSite, getBlogTaxonomy, type BlogPost } from "../content/blog";
import { berlinToUtc, formatRfc2822 } from "./format";
import { ImageLoading } from "./image-attributes";
import { EXCERPT_REMOVED_BLOCKS } from "./listing";
import type { Root, RootContent } from "hast";
import type { Root as MdastRoot } from "mdast";
import rehypeRaw from "rehype-raw";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { renderPostContent } from "./markdown";
import { wptexturize } from "./texturize";
import { getFeedListings, ORIGIN } from "./view";

/**
 * RSS 2.0 feeds of the blog like WordPress (wp-includes/feed-rss2.php):
 * /blog/feed/ and the feeds of every category, author and tag, each with the
 * newest posts of its list and their whole content. URLs are absolute on the
 * live origin, also in a build with basePath (the feed belongs to the domain).
 */

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** <![CDATA[…]]> for any text (a "]]>" inside is split like WordPress does). */
function cdata(text: string) {
  return `<![CDATA[${text.replace(/]]>/g, "]]&gt;")}]]>`;
}

const isBr = (node: RootContent | undefined) => node?.type === "element" && node.tagName === "br";

/**
 * Text like strip_tags() after wpautop(): tags vanish without a space, but
 * wpautop() turns "<br><br>" into a paragraph break, which separates words.
 */
function textOf(node: Root | RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element" && ["script", "style"].includes(node.tagName)) return "";
  if (!("children" in node)) return "";
  return node.children
    .map((child, index, siblings) => {
      if (!isBr(child)) return textOf(child);
      const next = siblings
        .slice(index + 1)
        .find((other) => !(other.type === "text" && !other.value.trim()));
      return isBr(next) ? "\n" : "";
    })
    .join("");
}

/**
 * The content as a tree for the excerpt. Markdown line breaks become a bare
 * <br> like the WordPress source (Markdown renders "<br>\n"): strip_tags()
 * then joins the words around it.
 */
function excerptTree(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(() => (tree: MdastRoot) => {
      visit(tree, "break", (_node, index, parent) => {
        if (parent && index !== undefined) parent.children[index] = { type: "html", value: "<br>" };
      });
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw);
  return processor.runSync(processor.parse(markdown)) as Root;
}

/**
 * The description of a feed item: wp_trim_excerpt() of the whole content (a
 * feed ignores <!--more-->), the first 55 words of the text without the
 * removed blocks, " […]" when it goes on. Words are split at ASCII
 * whitespace like wp_trim_words(); tags are stripped without a space.
 */
export function feedExcerpt(markdown: string): string {
  const tree = excerptTree(markdown);
  tree.children = tree.children.filter((node) => {
    if (node.type !== "element") return true;
    const classes = (node.properties.className as string[] | undefined) ?? [];
    return !EXCERPT_REMOVED_BLOCKS.some((name) => classes.includes(`wp-block-${name}`));
  });
  const words = textOf(tree)
    .trim()
    .split(/[\n\r\t ]+/)
    .filter(Boolean);
  return words.length > 55 ? `${words.slice(0, 55).join(" ")} […]` : words.join(" ");
}

/** Category names of an item: categories, then tags, by name, without duplicates (the_category_rss). */
async function itemCategories(post: BlogPost) {
  const taxonomy = await getBlogTaxonomy();
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "de", { sensitivity: "base" });
  const names = [
    ...post.frontmatter.categories.map(taxonomy.category).sort(byName),
    ...post.frontmatter.tags.map(taxonomy.tag).sort(byName),
  ].map((term) => term.name);
  return [...new Set(names)];
}

async function item(post: BlogPost, loading: ImageLoading) {
  const { frontmatter } = post;
  const taxonomy = await getBlogTaxonomy();
  const content = renderPostContent(post.content, {
    wpId: frontmatter.wpId,
    permalink: post.permalink,
    mode: "single",
    loading,
    urlPrefix: ORIGIN,
  }).html;
  const categories = (await itemCategories(post))
    .map((name) => `\t\t<category>${cdata(name)}</category>\n`)
    .join("");
  return (
    `\t<item>\n` +
    `\t\t<title>${escapeXml(wptexturize(frontmatter.title))}</title>\n` +
    `\t\t<link>${ORIGIN}${post.permalink}</link>\n` +
    `\t\t\n` +
    `\t\t<dc:creator>${cdata(taxonomy.author(frontmatter.author).name)}</dc:creator>\n` +
    `\t\t<pubDate>${formatRfc2822(berlinToUtc(frontmatter.date))}</pubDate>\n` +
    // The template indents the first category line twice.
    `\t\t${categories}` +
    `\t\t<guid isPermaLink="false">${escapeXml(frontmatter.guid)}</guid>\n\n` +
    `\t\t\t\t\t<description>${cdata(escapeXml(feedExcerpt(post.content)))}</description>\n` +
    `\t\t\t\t\t\t\t\t\t\t<content:encoded>${cdata(`\n${content}\n`)}</content:encoded>\n` +
    `\t\t\t\t\t\n\t\t\n\t\t\n\t\t\t</item>\n`
  );
}

/** The feed of a list ("" = blog, "category/newsletter" …), null if it has none. */
export async function renderFeed(path: string): Promise<string | null> {
  const [site, listings] = await Promise.all([getBlogSite(), getFeedListings()]);
  const listing = listings.find((entry) => entry.path === path);
  if (!listing) return null;
  const posts = listing.posts.slice(0, site.postsPerFeed);
  // get_feed_build_date(): the newest post_modified_gmt of the items.
  const built = posts
    .map((post) => berlinToUtc(post.frontmatter.modified))
    .reduce((newest, date) => (date > newest ? date : newest));
  const loading = new ImageLoading();
  const items: string[] = [];
  for (const post of posts) items.push(await item(post, loading));
  const title = listing.name ? `${listing.name} – ${site.title}` : site.title;
  return (
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"\n` +
    `\txmlns:content="http://purl.org/rss/1.0/modules/content/"\n` +
    `\txmlns:wfw="http://wellformedweb.org/CommentAPI/"\n` +
    `\txmlns:dc="http://purl.org/dc/elements/1.1/"\n` +
    `\txmlns:atom="http://www.w3.org/2005/Atom"\n` +
    `\txmlns:sy="http://purl.org/rss/1.0/modules/syndication/"\n` +
    `\txmlns:slash="http://purl.org/rss/1.0/modules/slash/"\n` +
    `\t>\n\n<channel>\n` +
    `\t<title>${escapeXml(title)}</title>\n` +
    `\t<atom:link href="${ORIGIN}${listing.href}" rel="self" type="application/rss+xml" />\n` +
    `\t<link>${ORIGIN}/blog</link>\n` +
    `\t<description></description>\n` +
    `\t<lastBuildDate>${formatRfc2822(built)}</lastBuildDate>\n` +
    `\t<language>de</language>\n` +
    `\t<sy:updatePeriod>\n\thourly\t</sy:updatePeriod>\n` +
    `\t<sy:updateFrequency>\n\t1\t</sy:updateFrequency>\n` +
    items.join("\t") +
    `\t</channel>\n</rss>\n`
  );
}

/** Response of a feed route (static hosts choose the Content-Type by the file name). */
export async function feedResponse(path: string): Promise<Response> {
  const xml = await renderFeed(path);
  if (xml === null) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=UTF-8" } });
}

/** generateStaticParams() of the feed routes of one kind ("category", "author", "tag"). */
export async function feedStaticParams(kind: string): Promise<Array<{ slug: string }>> {
  return (await getFeedListings())
    .filter((listing) => listing.path.startsWith(`${kind}/`))
    .map((listing) => ({ slug: listing.path.slice(kind.length + 1) }));
}
