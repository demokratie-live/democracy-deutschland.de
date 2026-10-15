/**
 * Compares the DOM of every blog page with the live WordPress blog.
 *
 *   pnpm compare-blog-dom [--local http://localhost:3000] [--refresh] [pfad …]
 *
 * Without paths it checks all pages of the static blog (/blog/, /blog/page/N/,
 * the archives, every permalink) and some search pages (SEARCH_PATHS). Search
 * pages render on the client: their DOM comes from Chromium (Playwright). Live pages are read once into
 * .cache/blog-import/ (shared with the import, --refresh reads them again).
 * Compared, in canonical form (scripts/blog/normalize.ts): <title>, body
 * class, head links (canonical, shortlink, feeds), header, navigation, header
 * image, main#site-content (posts, sidebar) and credits. URLs are reduced to
 * their path; known, documented deviations (docs/abweichungen.md) are mapped
 * before comparing: random ids of the search form, the alt="" of the header
 * image, data: images of the import and images hotlinked from the Wayback
 * Machine (both local files in uploads/inline/), x-webdoc:// links, invalid attribute
 * names, the runaway logo tag of News #2, and the comment and search feeds
 * the port does not have.
 *
 * Result: compare-results/blog-dom/<slug>.diff per differing page, summary on stdout.
 */
import fs from "fs/promises";
import path from "path";
import type { Browser } from "@playwright/test";
import type { Element, Root } from "hast";
import { createTwoFilesPatch } from "diff";
import { fromHtml } from "hast-util-from-html";
import { closeRunawayImgTags } from "./blog/live-fixes";
import { normalizeNodes } from "./blog/normalize";

const ORIGIN = "https://democracy-deutschland.de";
const CACHE = path.join(process.cwd(), ".cache/blog-import");
const OUT = path.join(process.cwd(), "compare-results/blog-dom");
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

/**
 * Search pages without base64 matches on live (docs/abweichungen.md): several
 * pages, the last page, one page, no results, the empty search, an umlaut.
 */
const SEARCH_PATHS = [
  "/blog/?s=bundestag+abstimmung",
  "/blog/page/2/?s=bundestag+abstimmung",
  "/blog/page/3/?s=bundestag+abstimmung",
  "/blog/?s=reality+check",
  "/blog/?s=xyzxyzq",
  "/blog/?s=",
  "/blog/page/6/?s=",
  "/blog/?s=gr%C3%BCnen",
];

/** All static blog paths (the static params of the blog route) and the search pages. */
async function allPaths(): Promise<string[]> {
  const { blogStaticParams } = await import("../src/lib/blog/view");
  const params = await blogStaticParams();
  return [
    ...params.map(({ path: segments }) => `/blog/${segments.map((s) => `${s}/`).join("")}`),
    ...SEARCH_PATHS,
  ];
}

let browser: Browser | undefined;

/** The DOM of a search page once BlogSearch has rendered the results. */
async function renderedHtml(url: string): Promise<string> {
  const { chromium } = await import("@playwright/test");
  browser ??= await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(url);
    await page.waitForFunction(() => document.body.classList.contains("search"), undefined, {
      timeout: 30_000,
    });
    return await page.content();
  } finally {
    await page.close();
  }
}

const cls = (element: Element) => ((element.properties.className as string[]) ?? []).join(" ");

function find(node: Root | Element, test: (element: Element) => boolean): Element | undefined {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    if (test(child)) return child;
    const found = find(child, test);
    if (found) return found;
  }
  return undefined;
}

function regions(tree: Root) {
  const body = find(tree, (e) => e.tagName === "body");
  const title = find(tree, (e) => e.tagName === "title");
  const head = find(tree, (e) => e.tagName === "head");
  // canonical, shortlink and the feeds; the port has no comment feeds and no
  // search feed (docs/abweichungen.md).
  const links = head
    ? head.children.filter(
        (child): child is Element =>
          child.type === "element" &&
          child.tagName === "link" &&
          (["canonical", "shortlink"].includes(String((child.properties.rel as string[])?.[0])) ||
            (child.properties.type === "application/rss+xml" &&
              !/Kommentar-Feed|Suchergebnis-Feed/.test(String(child.properties.title)))),
      )
    : [];
  return [
    { name: "title", nodes: title ? [title] : [] },
    { name: "body class", nodes: [{ type: "text" as const, value: body ? cls(body) : "" }] },
    { name: "head links", nodes: links },
    ...[
      ["header", (e: Element) => e.tagName === "header"],
      ["navigation", (e: Element) => cls(e).startsWith("navigation ")],
      ["header image", (e: Element) => cls(e).startsWith("header-image")],
      ["main", (e: Element) => e.properties.id === "site-content"],
      ["credits", (e: Element) => cls(e).startsWith("credits ")],
    ].map(([name, test]) => {
      const element = body && find(body, test as (e: Element) => boolean);
      return { name: name as string, nodes: element ? [element] : [] };
    }),
  ];
}

function mapUrl(side: "live" | "local") {
  return (url: string) => {
    let value = url
      .trim()
      .replace(/^(?:https?:)?\/\/(?:www\.)?democracy-deutschland\.de(?=\/blog\/)/, "");
    if (side === "live") {
      value = value
        .replace(/^https:\/\/democracy-deutschland\.de\/blog$/, "/blog/")
        // Apple Mail leftovers point to the anchor (decision Manuel 2026-10-13).
        .replace(/^x-webdoc:\/\/[^#]*(#.*)$/, "$1")
        // Images hotlinked from the Wayback Machine are local copies.
        .replace(/^https:\/\/web\.archive\.org\/web\/\d+im_\/.*$/, "data:…");
    } else if (BASE_PATH && value.startsWith(`${BASE_PATH}/`)) {
      value = value.slice(BASE_PATH.length);
    }
    // Absolute links of the head stay absolute on both sides.
    value = value.replace(/^\/blog\/wp-content\/uploads\/inline\/[^"]+$/, "data:…");
    return value.startsWith("data:") ? "data:…" : value;
  };
}

/**
 * WordPress gives the search form random ids (uniqid), the port fixed ones.
 * force_balance_tags() turns `<democracy_logo>` inside the id of the broken
 * logo tag into `<democracy_logo/>` on the index; the attribute has no effect.
 */
function mapAttribute(name: string, value: string) {
  if (name !== "id") return value;
  return value
    .replace(/^(search-form|s)-[0-9a-f]+$/, "$1-#")
    .replace("<democracy_logo/>", "<democracy_logo>");
}

/** Deviations of the live DOM that the port fixes on purpose, applied to the live tree. */
function prepareLive(tree: Root) {
  const walk = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      // Attribute names HTML cannot serialize (broken logo tag) are dropped by the import.
      for (const key of Object.keys(child.properties)) {
        if (/["'<>/=\s]/.test(key)) delete child.properties[key];
      }
      // The header image of the index has no alt on live; the port adds alt="".
      if (
        child.tagName === "img" &&
        child.properties.alt === undefined &&
        node.type === "element" &&
        cls(node).startsWith("header-image")
      ) {
        child.properties.alt = "";
      }
      walk(child);
    }
  };
  walk(tree);
}

async function main() {
  const list = paths.length ? paths : await allPaths();
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  let differing = 0;
  for (const route of list) {
    // News #2: the runaway logo tag is closed like in the import (docs/abweichungen.md).
    const liveTree = fromHtml(closeRunawayImgTags(await live(`${ORIGIN}${route}`)));
    prepareLive(liveTree);
    let html: string;
    if (/[?&]s=/.test(route)) {
      html = await renderedHtml(`${local}${BASE_PATH}${route}`);
    } else {
      const response = await fetch(`${local}${BASE_PATH}${route}`);
      if (!response.ok) throw new Error(`${response.status} ${local}${route}`);
      html = await response.text();
    }
    const localTree = fromHtml(html);
    const liveRegions = regions(liveTree);
    const localRegions = regions(localTree);
    const patches: string[] = [];
    for (const [index, region] of liveRegions.entries()) {
      const a = normalizeNodes(region.nodes, { mapUrl: mapUrl("live"), mapAttribute });
      const b = normalizeNodes(localRegions[index].nodes, {
        mapUrl: mapUrl("local"),
        mapAttribute,
      });
      if (a !== b) {
        patches.push(
          createTwoFilesPatch(`live ${region.name}`, `lokal ${region.name}`, `${a}\n`, `${b}\n`),
        );
      }
    }
    if (patches.length) {
      differing++;
      const slug = route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
      await fs.writeFile(path.join(OUT, `${slug}.diff`), patches.join("\n"));
      const changed = patches
        .join("\n")
        .split("\n")
        .filter((line) => /^[+-][^+-]/.test(line)).length;
      console.log(
        `  ❌ ${route}: ${changed} geänderte Zeilen (${path.relative(process.cwd(), OUT)}/${slug}.diff)`,
      );
    } else {
      console.log(`  ✅ ${route}`);
    }
  }
  await browser?.close();
  console.log(`\n${list.length - differing} von ${list.length} Seiten gleich.\n`);
  if (differing) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
