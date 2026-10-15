/**
 * Compares the RSS feeds of the static blog with the live WordPress feeds.
 *
 *   pnpm compare-blog-feed [--local http://localhost:3000] [--refresh] [pfad …]
 *
 * Without paths it checks every feed: /blog/feed/ and the feeds of all
 * categories, authors and tags. Live feeds are read once into
 * .cache/blog-import/ (--refresh reads them again). Compared after XML
 * decoding: the channel (title, self link, link, lastBuildDate, language)
 * and per item title, link, author, pubDate, categories, guid, description
 * (as text) and content (canonical DOM, scripts/blog/normalize.ts).
 * Deviations on purpose (docs/abweichungen.md): no generator element, and
 * emoji stay characters where WordPress puts images of s.w.org into feeds
 * (wp_staticize_emoji); the live images count as their alt text. Uploads of
 * old posts point to democracy-deutschland.de instead of www. (the import
 * stores local paths).
 *
 * Result: compare-results/blog-feed/<slug>.diff per differing feed, summary on stdout.
 */
import fs from "fs/promises";
import path from "path";
import { createTwoFilesPatch } from "diff";
import { fromHtml } from "hast-util-from-html";
import { normalizeNodes } from "./blog/normalize";

const ORIGIN = "https://democracy-deutschland.de";
const CACHE = path.join(process.cwd(), ".cache/blog-import");
const OUT = path.join(process.cwd(), "compare-results/blog-feed");
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const localIndex = args.indexOf("--local");
const local = (localIndex >= 0 ? args[localIndex + 1] : "http://localhost:3000").replace(/\/$/, "");
const paths = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--local");

function cacheFile(url: string) {
  return path.join(CACHE, url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9._-]+/g, "_"));
}

async function live(url: string): Promise<string> {
  const file = cacheFile(url);
  if (!refresh) {
    try {
      return await fs.readFile(file, "utf-8");
    } catch {
      // not cached
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 700));
  const response = await fetch(url, { headers: { "User-Agent": "democracy-blog-import" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const text = await response.text();
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, text);
  return text;
}

/** The dev server serves the feed route at …/feed/index.html, the export at …/feed/. */
async function localFeed(route: string): Promise<string> {
  for (const url of [`${local}${BASE_PATH}${route}`, `${local}${BASE_PATH}${route}index.html`]) {
    const response = await fetch(url);
    if (response.ok) return response.text();
  }
  throw new Error(`Feed fehlt lokal: ${route}`);
}

async function allFeeds(): Promise<string[]> {
  const { getFeedListings } = await import("../src/lib/blog/view");
  return (await getFeedListings()).map((listing) => listing.href);
}

function decodeXml(text: string) {
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(text.trim());
  if (cdata) return cdata[1];
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function elements(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  return [...xml.matchAll(pattern)].map((match) => decodeXml(match[1]));
}

/** HTML of a description as plain text (WordPress encodes it inside CDATA). */
function htmlText(html: string) {
  const text = (node: { type: string; value?: string; children?: unknown[] }): string =>
    node.type === "text"
      ? (node.value ?? "")
      : ((node.children as (typeof node)[] | undefined) ?? []).map(text).join("");
  return text(fromHtml(html, { fragment: true }))
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalContent(html: string) {
  const text = html
    .replace(/<img [^>]*class="wp-smiley"[^>]*>/g, (tag) => /alt="([^"]*)"/.exec(tag)?.[1] ?? "")
    .replace(/\uFE0F/g, "")
    .replace(
      /https:\/\/www\.democracy-deutschland\.de\/blog\/wp-content\//g,
      `${ORIGIN}/blog/wp-content/`,
    );
  const tree = fromHtml(text, { fragment: true });
  return normalizeNodes(tree.children, {
    mapUrl: (url) => url.trim().replace(/^\/blog\/wp-content\/uploads\/inline\/.*$/, "data:…"),
  }).replace(/"data:image\/[^"]*"/g, '"data:…"');
}

/** The feed in a comparable text form, one field per line. */
function describe(xml: string) {
  const [channel] = xml.split("<item>");
  const lines = [
    `title: ${elements(channel, "title")[0]}`,
    `self: ${/<atom:link href="([^"]+)"/.exec(channel)?.[1]}`,
    `link: ${elements(channel, "link")[0]}`,
    `description: ${elements(channel, "description")[0]}`,
    `lastBuildDate: ${elements(channel, "lastBuildDate")[0]}`,
    `language: ${elements(channel, "language")[0]}`,
  ];
  for (const item of elements(xml, "item")) {
    lines.push(
      "",
      `item: ${elements(item, "title")[0]}`,
      `  link: ${elements(item, "link")[0]}`,
      `  creator: ${elements(item, "dc:creator")[0]}`,
      `  pubDate: ${elements(item, "pubDate")[0]}`,
      `  categories: ${elements(item, "category").join(" | ")}`,
      `  guid: ${elements(item, "guid")[0]}`,
      `  description: ${htmlText(elements(item, "description")[0] ?? "")}`,
      `  content:`,
      ...canonicalContent(elements(item, "content:encoded")[0] ?? "")
        .split("\n")
        .map((line) => `    ${line}`),
    );
  }
  return lines.join("\n");
}

async function main() {
  const list = paths.length ? paths : await allFeeds();
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  let differing = 0;
  for (const route of list) {
    const a = describe(await live(`${ORIGIN}${route}`));
    const b = describe(await localFeed(route));
    if (a === b) {
      console.log(`  ✅ ${route}`);
      continue;
    }
    differing++;
    const slug = route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
    const patch = createTwoFilesPatch(`live ${route}`, `lokal ${route}`, `${a}\n`, `${b}\n`);
    await fs.writeFile(path.join(OUT, `${slug}.diff`), patch);
    const changed = patch.split("\n").filter((line) => /^[+-][^+-]/.test(line)).length;
    console.log(
      `  ❌ ${route}: ${changed} geänderte Zeilen (${path.relative(process.cwd(), OUT)}/${slug}.diff)`,
    );
  }
  console.log(`\n${list.length - differing} von ${list.length} Feeds gleich.`);
  if (differing) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
