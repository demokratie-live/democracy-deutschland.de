/**
 * Imports the WordPress blog (democracy-deutschland.de/blog/) into the repo.
 * Repeatable while WordPress runs; read-only requests, one after another.
 *
 *   pnpm import-blog [--refresh] [--only <slug>]
 *
 *   --refresh      fetch again instead of using the cache (.cache/blog-import/)
 *   --only <slug>  convert only this post (for debugging; writes nothing else)
 *
 * Sources: the REST API (wp-json/wp/v2: posts, media, categories, tags, users)
 * for the metadata, the rendered post page for the content (it equals
 * content.rendered except for the `<!--more-->` span and loading attributes,
 * the script checks that).
 *
 * Writes:
 *   content/blog/<slug>.md       frontmatter + content as Markdown with inline HTML
 *   content/blog/taxonomy.yaml   authors, categories, tags
 *   content/blog/media.yaml      featured images with their sizes (srcset)
 *   src/lib/blog/inline-css/     the inline <style> blocks of the WordPress head
 *   public/blog/wp-content/uploads/…  every referenced upload (incl. srcset sizes),
 *                                     data: images as uploads/inline/<slug>-<n>.<ext>
 * and deletes posts and uploads that are no longer referenced.
 */
import fs from "fs/promises";
import path from "path";
import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import yaml from "yaml";
import { blogPermalink } from "../src/lib/content/blog";
import { attachmentImage, ImageLoading } from "../src/lib/blog/images";
import { mapSrcSet, renderPostContent } from "../src/lib/blog/markdown";
import { wptexturize } from "../src/lib/blog/texturize";
import type { BlogMedia, BlogPostFrontmatter, BlogTaxonomy } from "../src/lib/schemas/blog";
import { htmlToMarkdown, type ConversionStats } from "./blog/html-to-markdown";
import { closeRunawayImgTags } from "./blog/live-fixes";

const ORIGIN = "https://democracy-deutschland.de";
const API = `${ORIGIN}/blog/wp-json/wp/v2`;
const ROOT = process.cwd();
const CACHE = path.join(ROOT, ".cache/blog-import");
const BLOG_DIR = path.join(ROOT, "content/blog");
const PUBLIC = path.join(ROOT, "public");
const UPLOADS = "/blog/wp-content/uploads/";
const INLINE_CSS = path.join(ROOT, "src/lib/blog/inline-css");
/** Theme sizes of the featured images (index and single post). */
const FEATURED_SIZES = ["post-image", "post-image-cover"];
const DELAY_MS = 700;

const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;

// ---------------------------------------------------------------- fetching

let lastRequest = 0;

async function politeFetch(url: string): Promise<Response> {
  const wait = lastRequest + DELAY_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(url, { headers: { "User-Agent": "democracy-blog-import" } });
  return response;
}

function cacheFile(url: string) {
  return path.join(CACHE, url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9._-]+/g, "_"));
}

/** GET with a file cache; the import reads every URL once per run at most. */
async function getText(url: string): Promise<string> {
  const file = cacheFile(url);
  if (!refresh) {
    try {
      return await fs.readFile(file, "utf-8");
    } catch {
      // not cached yet
    }
  }
  const response = await politeFetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const text = await response.text();
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, text);
  return text;
}

/** All pages of a REST collection (context=view). */
async function getCollection<T>(endpoint: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const url = `${API}/${endpoint}?per_page=100&page=${page}&context=view`;
    const batch = JSON.parse(await getText(url)) as T[];
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

// ---------------------------------------------------------------- REST types

interface WpPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
  format: string;
  sticky: boolean;
  class_list: string[];
}

interface WpMedia {
  id: number;
  source_url: string;
  media_details: {
    width?: number;
    height?: number;
    file?: string;
    sizes?: Record<string, { file: string; width: number; height: number; source_url: string }>;
  };
}

interface WpTerm {
  id: number;
  slug: string;
  name: string;
}

// ---------------------------------------------------------------- helpers

const decoder = (html: string) =>
  fromHtml(`<p>${html}</p>`, { fragment: true }).children.map(textOf).join("");

function textOf(node: Root["children"][number]): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/**
 * Raw `post_title` from `title.rendered`: wptexturize writes its replacements
 * as numeric references, typed characters stay literal (AGENTS.md, "Blog").
 */
function rawTitle(rendered: string): string {
  const raw = rendered
    .replace(/&#821[67];/g, "'")
    .replace(/&#822[0-2];/g, '"')
    .replace(/ &#8211; /g, " - ")
    .replace(/ &#8212; /g, " -- ")
    .replace(/&#8230;/g, "...")
    .replace(/&#038;/g, "&");
  return decoder(raw);
}

/** Absolute or www. URL of an upload → path under /blog/wp-content/uploads/. */
function localUpload(url: string): string {
  return url.replace(
    /^(?:https?:)?\/\/(?:www\.)?democracy-deutschland\.de(?=\/blog\/wp-content\/)/,
    "",
  );
}

function stripUrlNoise(url: string) {
  return url.split(/[?#]/)[0];
}

/** Content of `.post-content` on the rendered post page. */
function liveContent(page: string, id: number): string {
  const match =
    /<div class="post-content entry-content">\s*([\s\S]*?)\s*<\/div><!-- \.post-content -->/.exec(
      page,
    );
  if (!match) throw new Error(`Post ${id}: .post-content nicht gefunden`);
  return match[1];
}

/** The rendered page against content.rendered: only the known differences. */
function checkAgainstRest(live: string, rest: string, id: number) {
  const normalize = (html: string) =>
    html
      .replace(/<span id="more-\d+"><\/span>|<!--more-->/g, "<!--more-->")
      .replace(/ loading="lazy"| fetchpriority="high"/g, "")
      .replace(/sizes="auto, /g, 'sizes="')
      .trim();
  if (normalize(live) !== normalize(rest)) {
    throw new Error(`Post ${id}: Inhalt der Seite weicht von content.rendered ab`);
  }
}

const closedTags: number[] = [];
function closeRunawayTags(html: string, id: number): string {
  const result = closeRunawayImgTags(html);
  if (result !== html) closedTags.push(id);
  return result;
}

const dataUriFiles: Array<{ file: string; data: Buffer }> = [];

/**
 * Prepares the post HTML for Markdown: the more span becomes `<!--more-->`,
 * loading attributes go (the page adds them), uploads get local paths, data:
 * images become files, Apple-Mail links x-webdoc://…#anchor point to #anchor.
 */
function prepareContent(html: string, post: WpPost): Root {
  const tree = fromHtml(html, { fragment: true });
  let dataIndex = 0;
  visit(tree, "element", (node: Element, index, parent) => {
    const props = node.properties;
    if (
      node.tagName === "span" &&
      props.id === `more-${post.id}` &&
      parent &&
      index !== undefined
    ) {
      parent.children[index] = { type: "comment", value: "more" };
      return;
    }
    delete props.loading;
    delete props.fetchPriority;
    // Broken markup (the logo of the old newsletter footers) leaves attribute
    // names HTML cannot serialize, e.g. `mailto:…de"`; they have no effect.
    for (const key of Object.keys(props)) {
      if (/["'<>/=\s]/.test(key)) delete props[key];
    }
    if (typeof props.sizes === "string") props.sizes = props.sizes.replace(/^auto, /, "");
    for (const key of ["src", "href"] as const) {
      if (typeof props[key] === "string") props[key] = localUpload(props[key]);
    }
    if (props.srcSet) props.srcSet = mapSrcSet(props.srcSet, localUpload);
    if (typeof props.href === "string" && props.href.startsWith("x-webdoc://")) {
      const hash = props.href.indexOf("#");
      if (hash >= 0) props.href = props.href.slice(hash);
    }
    const data =
      typeof props.src === "string" &&
      /^data:image\/(png|jpe?g|gif|webp);base64,([\s\S]*)$/.exec(props.src);
    if (node.tagName === "img" && data) {
      dataIndex++;
      const extension = data[1] === "jpeg" ? "jpg" : data[1];
      const file = `${UPLOADS}inline/${post.slug}-${dataIndex}.${extension}`;
      dataUriFiles.push({ file, data: Buffer.from(data[2], "base64") });
      props.src = file;
    }
  });
  return tree;
}

/** YAML double-quoted string; invisible and control characters as unicode escapes. */
function quote(value: string) {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(
      /[\u0000-\u001f\u007f-\u009f\u00a0\u00ad\u200b-\u200f\u2028\u2029\ufeff]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
  return `"${escaped}"`;
}

/** A slug as YAML scalar; numeric slugs ("2021") need quotes to stay strings. */
function slugYaml(slug: string) {
  return /^[0-9]+$/.test(slug) ? `"${slug}"` : slug;
}

/** Frontmatter in a fixed order, compact like the hand-written files. */
function frontmatterYaml(fm: BlogPostFrontmatter) {
  const lines = [
    `wpId: ${fm.wpId}`,
    `title: ${quote(fm.title)}`,
    `slug: ${slugYaml(fm.slug)}`,
    `date: "${fm.date}"`,
    `modified: "${fm.modified}"`,
    `author: ${slugYaml(fm.author)}`,
    `categories: [${fm.categories.map(slugYaml).join(", ")}]`,
    `tags: [${fm.tags.map(slugYaml).join(", ")}]`,
    `featuredMedia: ${fm.featuredMedia}`,
    ...(fm.image ? [`image: ${quote(fm.image)}`] : []),
    `excerpt: ${quote(fm.excerpt)}`,
  ];
  return `${lines.join("\n")}\n`;
}

/** Upload paths referenced by an HTML string. */
function uploadsIn(html: string): string[] {
  const found: string[] = [];
  const tree = fromHtml(html, { fragment: true });
  visit(tree, "element", (node: Element) => {
    const props = node.properties;
    for (const key of ["src", "href"] as const) {
      if (typeof props[key] === "string") found.push(props[key]);
    }
    if (props.srcSet) mapSrcSet(props.srcSet, (url) => (found.push(url), url));
  });
  return found.filter((url) => url.startsWith(UPLOADS)).map((url) => decodeURI(stripUrlNoise(url)));
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- inline CSS

/** Inline <style> blocks of a page head → src/lib/blog/inline-css/<name>.css. */
function inlineStyles(page: string): Map<string, string> {
  const head = page.split("</head>")[0];
  const styles = new Map<string, string>();
  const strip = (css: string) => css.replace(/\n?\/\*# sourceURL=[^*]*\*\/\n?/g, "\n");
  for (const match of head.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)) {
    const id = /id="([^"]+)-inline-css"/.exec(match[1])?.[1];
    const css = strip(match[2]);
    if (id === "global-styles") {
      // Base styles, then one line per rendered block (gallery, latest-posts …).
      const lines = css.trim().split("\n");
      styles.set("global-styles", `${lines[0]}\n`);
      for (const line of lines.slice(1)) {
        const block = /^:where\(\.wp-block-([a-z-]+)\./.exec(line)?.[1];
        if (!block) throw new Error(`Unbekannte Zeile in global-styles: ${line.slice(0, 80)}`);
        styles.set(`global-styles.${block}`, `${line}\n`);
      }
    } else if (id === "core-block-supports") {
      // Per-instance rules (wp-block-gallery-1): rebuilt from the content.
      continue;
    } else if (id === "wp-emoji-styles") {
      // No emoji script on the static blog (decision Manuel 2026-10-13).
      continue;
    } else if (id) {
      styles.set(id, `${css.trim()}\n`);
    } else if (/Customizer CSS/.test(head.slice(Math.max(0, match.index - 40), match.index))) {
      styles.set("customizer", `${css.trim()}\n`);
    } else if (/--font-base/.test(css)) {
      styles.set("fonts-plugin", `${css.trim()}\n`);
    } else {
      throw new Error(`Unbekannter <style>-Block: ${css.slice(0, 80)}`);
    }
  }
  return styles;
}

// ---------------------------------------------------------------- main

async function main() {
  console.log("REST-API …");
  const posts = (await getCollection<WpPost>("posts")).filter(
    (post) => post.status === "publish" && post.type === "post",
  );
  const media = await getCollection<WpMedia>("media");
  const categories = await getCollection<WpTerm>("categories");
  const tags = await getCollection<WpTerm>("tags");
  const users = await getCollection<WpTerm>("users");
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const byId = <T extends WpTerm>(list: T[]) => new Map(list.map((item) => [item.id, item]));
  const categoryById = byId(categories);
  const tagById = byId(tags);
  const userById = byId(users);
  console.log(`  ${posts.length} Posts, ${media.length} Medien`);

  const used = {
    authors: new Set<number>(),
    categories: new Set<number>(),
    tags: new Set<number>(),
  };
  const featured = new Map<number, BlogMedia[number]>();
  const styles = new Map<string, string>();
  const written = new Set<string>();
  const stats: ConversionStats = { markdown: 0, html: 0 };

  for (const post of posts) {
    if (only && post.slug !== only) continue;
    if (post.format !== "standard" || post.sticky) {
      throw new Error(`Post ${post.id}: Format ${post.format}/sticky wird nicht unterstützt`);
    }

    // Title: raw for the press teasers, the blog texturizes it again.
    const title = rawTitle(post.title.rendered);
    if (wptexturize(title) !== decoder(post.title.rendered)) {
      throw new Error(
        `Post ${post.id}: wptexturize("${title}") ≠ "${decoder(post.title.rendered)}" – Regel in src/lib/blog/texturize.ts ergänzen`,
      );
    }

    const page = await getText(post.link);
    for (const [name, css] of inlineStyles(page)) styles.set(name, css);
    const live = liveContent(page, post.id);
    checkAgainstRest(live, post.content.rendered, post.id);

    const tree = prepareContent(closeRunawayTags(live, post.id), post);
    const body = htmlToMarkdown(tree, stats);
    const leftover = /.{0,80}democracy-deutschland\.de\/blog\/wp-content.{0,40}/.exec(body);
    if (leftover) {
      throw new Error(`Post ${post.id}: Verweis auf den alten Server übrig: ${leftover[0]}`);
    }

    const author = userById.get(post.author);
    if (!author) throw new Error(`Post ${post.id}: Autor ${post.author} unbekannt`);
    used.authors.add(author.id);
    const postCategories = post.categories.map((id) => {
      const term = categoryById.get(id);
      if (!term) throw new Error(`Post ${post.id}: Kategorie ${id} unbekannt`);
      used.categories.add(id);
      return term;
    });
    const postTags = post.tags
      .map((id) => {
        const term = tagById.get(id);
        if (!term) throw new Error(`Post ${post.id}: Schlagwort ${id} unbekannt`);
        used.tags.add(id);
        return term;
      })
      // get_the_tag_list(): terms by name.
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

    let image: string | undefined;
    const attachment = post.featured_media ? mediaById.get(post.featured_media) : undefined;
    if (attachment) {
      const details = attachment.media_details;
      if (!details.file || !details.width || !details.height || !details.sizes) {
        throw new Error(`Bild ${attachment.id}: Metadaten unvollständig`);
      }
      image = `${UPLOADS}${details.file}`;
      featured.set(attachment.id, {
        id: attachment.id,
        file: image,
        width: details.width,
        height: details.height,
        sizes: Object.entries(details.sizes)
          .filter(([name]) => name !== "full")
          .map(([name, size]) => ({
            name,
            file: size.file,
            width: size.width,
            height: size.height,
          })),
      });
    }

    const frontmatter: BlogPostFrontmatter = {
      wpId: post.id,
      title,
      slug: post.slug,
      date: post.date,
      modified: post.modified,
      author: author.slug,
      categories: postCategories.map((term) => term.slug),
      tags: postTags.map((term) => term.slug),
      featuredMedia: post.featured_media,
      ...(image ? { image } : {}),
      excerpt: decoder(post.excerpt.rendered).trim(),
    };
    if (blogPermalink(frontmatter) !== post.link.replace(ORIGIN, "")) {
      throw new Error(`Post ${post.id}: Permalink ${post.link} passt nicht zu Datum und Slug`);
    }
    const file = path.join(BLOG_DIR, `${post.slug}.md`);
    await fs.writeFile(file, `---\n${frontmatterYaml(frontmatter)}---\n\n${body}`);
    written.add(file);
  }

  for (const { file, data } of dataUriFiles) {
    await fs.mkdir(path.dirname(path.join(PUBLIC, file)), { recursive: true });
    await fs.writeFile(path.join(PUBLIC, file), data);
  }
  if (closedTags.length) console.log(`  kaputtes Tag geschlossen in Post ${closedTags.join(", ")}`);
  console.log(
    `  ${written.size} Posts geschrieben (${stats.markdown} Blöcke Markdown, ${stats.html} HTML), ${dataUriFiles.length} data:-Bilder als Datei`,
  );
  if (only) return;

  // Posts that no longer exist in WordPress.
  for (const file of await listFiles(BLOG_DIR)) {
    if (file.endsWith(".md") && !written.has(file)) {
      await fs.rm(file);
      console.log(`  gelöscht: ${path.relative(ROOT, file)}`);
    }
  }

  // Taxonomy and featured images.
  const terms = (list: WpTerm[], ids: Set<number>) =>
    list
      .filter((term) => ids.has(term.id))
      .map(({ id, slug, name }) => ({ id, slug, name: decoder(name) }))
      .sort((a, b) => a.id - b.id);
  const taxonomy: BlogTaxonomy = {
    authors: terms(users, used.authors),
    categories: terms(categories, used.categories),
    tags: terms(tags, used.tags),
  };
  const header = "# Written by `pnpm import-blog` (scripts/import-blog.ts), do not edit by hand.\n";
  await fs.writeFile(path.join(BLOG_DIR, "taxonomy.yaml"), header + yaml.stringify(taxonomy));
  const mediaList = [...featured.values()].sort((a, b) => a.id - b.id);
  await fs.writeFile(path.join(BLOG_DIR, "media.yaml"), header + yaml.stringify(mediaList));

  // Inline CSS of the WordPress head.
  await fs.mkdir(INLINE_CSS, { recursive: true });
  for (const [name, css] of styles) await fs.writeFile(path.join(INLINE_CSS, `${name}.css`), css);
  console.log(`  ${styles.size} Inline-Stile`);

  // Uploads: everything the rendered pages reference.
  const site = yaml.parse(await fs.readFile(path.join(BLOG_DIR, "site.yaml"), "utf-8")) as {
    headerImage: string;
  };
  const needed = new Set<string>([site.headerImage]);
  for (const file of written) {
    const raw = await fs.readFile(file, "utf-8");
    const [, fm, ...rest] = raw.split(/^---$/m);
    const frontmatter = yaml.parse(fm) as BlogPostFrontmatter;
    const content = rest.join("---");
    for (const mode of ["single", "teaser"] as const) {
      const { html } = renderPostContent(content, {
        wpId: frontmatter.wpId,
        permalink: blogPermalink(frontmatter),
        mode,
        loading: new ImageLoading(),
      });
      for (const url of uploadsIn(html)) needed.add(url);
    }
    if (frontmatter.image) {
      needed.add(frontmatter.image);
      const item = featured.get(frontmatter.featuredMedia)!;
      for (const size of FEATURED_SIZES) {
        const img = attachmentImage(item, size);
        needed.add(img.src);
        for (const entry of img.srcSet?.split(", ") ?? [])
          needed.add(decodeURI(entry.split(" ")[0]));
      }
    }
  }

  const missingFile = path.join(BLOG_DIR, "missing-uploads.yaml");
  const knownMissing = new Set<string>(
    await fs
      .readFile(missingFile, "utf-8")
      .then((text) => yaml.parse(text) ?? [])
      .catch(() => []),
  );
  const missing: string[] = [];
  let downloaded = 0;
  for (const url of [...needed].sort()) {
    if (url.startsWith(`${UPLOADS}inline/`)) continue;
    const target = path.join(PUBLIC, url);
    try {
      await fs.access(target);
      if (!refresh) continue;
    } catch {
      // not there yet
    }
    if (knownMissing.has(url) && !refresh) {
      missing.push(url);
      continue;
    }
    const response = await politeFetch(`${ORIGIN}${encodeURI(url)}`);
    if (response.status === 404) {
      missing.push(url);
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
    downloaded++;
  }
  // Uploads nobody references any more.
  let removed = 0;
  for (const file of await listFiles(path.join(PUBLIC, UPLOADS))) {
    const url = `/${path.relative(PUBLIC, file).split(path.sep).join("/")}`;
    if (!needed.has(url)) {
      await fs.rm(file);
      removed++;
    }
  }
  let bytes = 0;
  for (const file of await listFiles(path.join(PUBLIC, UPLOADS)))
    bytes += (await fs.stat(file)).size;
  console.log(
    `  Uploads: ${needed.size - missing.length} verwendet (${(bytes / 1e6).toFixed(1)} MB), ${downloaded} geladen, ${removed} entfernt`,
  );
  await fs.writeFile(
    missingFile,
    "# Uploads the posts reference although live already answers 404 (written by `pnpm import-blog`).\n" +
      yaml.stringify(missing),
  );
  if (missing.length) {
    console.log(
      `  ${missing.length} verwiesene Uploads fehlen schon live (404), siehe content/blog/missing-uploads.yaml`,
    );
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
