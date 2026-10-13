/**
 * Vergleicht eine Route der statischen Seite mit der Live-Seite.
 *
 *   pnpm compare <pfad> [optionen]
 *   pnpm compare /wahlometer/ --local http://localhost:3074
 *   pnpm compare / --click ".info-badge:nth-of-type(3)"
 *
 * Optionen:
 *   --local <url>      lokale Basis-URL (Standard http://localhost:3000, Dev-Server oder `pnpm start`)
 *   --live <url>       Live-URL der Seite (Standard aus content/site/routes.yaml: /#!<state>)
 *   --click <selektor> vor dem Screenshot auf beiden Seiten klicken (mehrfach möglich)
 *   --hover <selektor> nach den Klicks mit der Maus auf das Element zeigen; Screenshot nur
 *                      vom sichtbaren Bereich um das Element (ganze Seite verliert den Hover)
 *   --live-eval <js>   JavaScript, das auf live vor den Klicks läuft, um eine bewusste
 *                      Abweichung nachzustellen (z.B. ein entferntes Duplikat); der Text-
 *                      vergleich gegen ?_escaped_fragment_ zeigt sie weiterhin
 *   --files <selektor> zwei Testdateien in das Datei-Feld setzen (vor den Klicks), z.B.
 *                      "#bug-files"; auf live wird XMLHttpRequest vorher abgeklemmt
 *   --no-mask          <video> und <iframe> nicht abdecken
 *   --viewport-only    nur den sichtbaren Bereich statt der ganzen Seite
 *   --only <name>      nur "desktop" oder "mobile" (z.B. für das Mobil-Menü)
 *
 * Blog (Pfade unter /blog/): live ist derselbe Pfad auf democracy-deutschland.de,
 * das Emoji-Skript von WordPress wird dort blockiert (entfällt statisch), Bilder
 * mit loading="lazy" laden auf beiden Seiten sofort, und text-content.diff
 * vergleicht den Text von main#site-content mit dem Server-HTML der Live-Seite.
 *
 * Ergebnis unter compare-results/<slug>/:
 *   <viewport>/live.png, local.png, diff.png  (1280 px Desktop, 375 px Mobil)
 *   text-visible.diff   sichtbarer Text (innerText) live gegen lokal, Desktop
 *   text-content.diff   Text von #content: ?_escaped_fragment_=<state> gegen lokal
 *   head.diff           Titel, Meta-Tags, Icons und Manifest live gegen lokal
 *   report.md, index.html
 */

import fs from "fs/promises";
import path from "path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { createTwoFilesPatch, diffWords } from "diff";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import yaml from "yaml";
import { routesSchema } from "../src/lib/schemas/site";

const LIVE_ORIGIN = "https://democracy-deutschland.de";

/** Blog paths compare against the same path of the WordPress blog. */
function isBlog(route: string) {
  return route === "/blog/" || route.startsWith("/blog/");
}

/** WordPress emoji script: the static blog has none (decision Manuel 2026-10-13). */
const LIVE_EMOJI_SCRIPT = /wp-emoji-release\.min\.js/;

/** Calls of the old API that send mail or store files: never reach them from here. */
const LIVE_WRITE_CALLS = /api\.php\?call=(send_mail|send_subscribe|upload|beta)/;

/** Test files for --files (names as in the e2e tests). */
const TEST_FILES = [
  { name: "screenshot-1.png", mimeType: "image/png", buffer: Buffer.from("test") },
  { name: "log.txt", mimeType: "text/plain", buffer: Buffer.from("test2") },
];
const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 800, isMobile: false },
  { name: "mobile-375", width: 375, height: 812, isMobile: true },
];

interface Options {
  route: string;
  local: string;
  live?: string;
  clicks: string[];
  hover?: string;
  liveEval?: string;
  files?: string;
  mask: boolean;
  fullPage: boolean;
  only?: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    route: "",
    local: "http://localhost:3000",
    clicks: [],
    mask: true,
    fullPage: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--local") options.local = argv[++i];
    else if (arg === "--live") options.live = argv[++i];
    else if (arg === "--click") options.clicks.push(argv[++i]);
    else if (arg === "--hover") options.hover = argv[++i];
    else if (arg === "--live-eval") options.liveEval = argv[++i];
    else if (arg === "--files") options.files = argv[++i];
    else if (arg === "--no-mask") options.mask = false;
    else if (arg === "--viewport-only") options.fullPage = false;
    else if (arg === "--only") options.only = argv[++i];
    else if (!arg.startsWith("--")) options.route = arg;
    else throw new Error(`Unbekannte Option: ${arg}`);
  }
  // A full-page screenshot resizes the viewport, the element leaves the mouse.
  if (options.hover) options.fullPage = false;
  if (!options.route) {
    throw new Error("Pfad fehlt, z.B. `pnpm compare /wahlometer/`");
  }
  if (!options.route.endsWith("/")) options.route += "/";
  options.local = options.local.replace(/\/$/, "");
  return options;
}

async function loadState(route: string) {
  if (isBlog(route)) return { state: "blog", isStart: false };
  const raw = await fs.readFile(path.join(process.cwd(), "content/site/routes.yaml"), "utf-8");
  const routes = routesSchema.parse(yaml.parse(raw));
  const entry = routes.routes.find((r) => r.path === route);
  if (!entry) throw new Error(`Pfad ${route} fehlt in content/site/routes.yaml`);
  return { state: entry.state, isStart: entry.state === routes.start };
}

/** Wait until the page (live: after the hash router loaded #content) is settled. */
async function settle(page: Page, container = "#content") {
  await page.waitForFunction(
    (selector) => (document.querySelector(selector)?.children.length ?? 0) > 0,
    container,
    { timeout: 30_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.evaluate(async () => {
    // Lazy images (blog) would stay unloaded outside the viewport.
    for (const img of document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) {
      img.loading = "eager";
    }
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((img) => !img.complete)
        .map(
          (img) => new Promise((resolve) => img.addEventListener("load", resolve, { once: true })),
        ),
    );
    for (const video of document.querySelectorAll("video")) {
      video.pause();
      video.currentTime = 0;
    }
  });
  await page.waitForTimeout(800);
}

async function capture(
  browser: Browser,
  url: string,
  viewport: (typeof VIEWPORTS)[number],
  options: Options,
  file: string,
  isLive: boolean,
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  if (isLive) await page.route(LIVE_WRITE_CALLS, (route) => route.abort());
  if (isLive) await page.route(LIVE_EMOJI_SCRIPT, (route) => route.abort());
  await page.goto(url, { waitUntil: "load" });
  await settle(page, isBlog(options.route) ? "#site-content" : "#content");
  if (isLive && options.liveEval) {
    await page.evaluate(options.liveEval);
    await page.waitForTimeout(300);
  }
  if (options.files) {
    // upload() of live posts every file at once: stop XMLHttpRequest first.
    if (isLive) {
      await page.evaluate(
        "XMLHttpRequest.prototype.open = function () {}; XMLHttpRequest.prototype.send = function () {};",
      );
    }
    await page.setInputFiles(options.files, TEST_FILES);
    await page.waitForTimeout(500);
  }
  for (const selector of options.clicks) {
    await page.locator(selector).first().click();
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  }
  if (options.hover) {
    const target = page.locator(options.hover).first();
    // Same scroll position on both sides: element centred, then the mouse.
    await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(800);
    await target.hover();
    await page.waitForTimeout(600);
  }
  let fullPage = options.fullPage;
  if (fullPage && isBlog(options.route)) {
    // A full-page screenshot enlarges the viewport; the blog images then pick
    // another srcset candidate and are captured while loading. Enlarge first,
    // let them load, then capture the viewport.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height });
    await settle(page, "#site-content");
    fullPage = false;
  }
  await page.screenshot({
    path: file,
    fullPage,
    animations: "disabled",
    mask: options.mask ? [page.locator("video"), page.locator("iframe")] : [],
  });
  const text = viewport.isMobile ? "" : await page.evaluate(() => document.body.innerText);
  const head = viewport.isMobile ? "" : await headEntries(page);
  await context.close();
  return { text, head };
}

/**
 * Title, <meta> and icon/manifest <link> of the rendered page as sorted lines.
 * Stylesheets are left out (live: one minified bundle). URLs are reduced to
 * their path without basePath so local and live are comparable.
 */
async function headEntries(page: Page) {
  // No backslashes in this string: it is a template literal.
  return page.evaluate<string>(`(() => {
    const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? "";
    const suffix = "/manifest.json";
    const base = manifest.endsWith(suffix) && manifest.startsWith("/")
      ? manifest.slice(0, -suffix.length)
      : "";
    const short = (href) => {
      const url = new URL(href, location.href);
      const path = url.origin === location.origin ? url.pathname : url.href;
      return base && path.startsWith(base + "/") ? path.slice(base.length) : path;
    };
    const lines = ["title: " + document.title];
    for (const meta of document.head.querySelectorAll("meta")) {
      const key = meta.getAttribute("name") || meta.getAttribute("property") || meta.getAttribute("http-equiv");
      if (key) lines.push("meta " + key + ": " + meta.getAttribute("content"));
    }
    for (const link of document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')) {
      const attrs = ["sizes", "type"].map((a) => link.getAttribute(a)).filter(Boolean).join(" ");
      lines.push("link " + link.rel + (attrs ? " " + attrs : "") + ": " + short(link.getAttribute("href")));
    }
    return lines.sort().join(String.fromCharCode(10));
  })()`);
}

/** Text of #content without scripts; for live from the server-rendered HTML. */
async function contentText(
  browser: Browser,
  url: string,
  javaScriptEnabled: boolean,
  container = "#content",
) {
  const context = await browser.newContext({ javaScriptEnabled });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  // Text nodes joined with spaces: the templates have whitespace between
  // block elements, JSX has not; that difference is not visible. Passed as a
  // string because tsx (esbuild) wraps nested functions in a __name helper.
  const text = await page.evaluate<string>(`(() => {
    const content = document.querySelector(${JSON.stringify(container)});
    if (!content) return "";
    const parts = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement.closest("script, style")) {
        parts.push(walker.currentNode.textContent);
      }
    }
    return parts.join(" ");
  })()`);
  await context.close();
  return text;
}

function normalizeLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeWords(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function pad(png: PNG, width: number, height: number) {
  if (png.width === width && png.height === height) return png;
  const out = new PNG({ width, height });
  out.data.fill(0);
  // Fill the padding magenta so missing areas stand out.
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255;
    out.data[i + 2] = 255;
    out.data[i + 3] = 255;
  }
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

async function diffImages(liveFile: string, localFile: string, diffFile: string) {
  const live = PNG.sync.read(await fs.readFile(liveFile));
  const local = PNG.sync.read(await fs.readFile(localFile));
  const width = Math.max(live.width, local.width);
  const height = Math.max(live.height, local.height);
  const a = pad(live, width, height);
  const b = pad(local, width, height);
  const diff = new PNG({ width, height });
  const changed = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });
  await fs.writeFile(diffFile, PNG.sync.write(diff));
  return {
    live: `${live.width}×${live.height}`,
    local: `${local.width}×${local.height}`,
    changed,
    percent: (changed / (width * height)) * 100,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { state, isStart } = await loadState(options.route);
  const blog = isBlog(options.route);
  const liveUrl =
    options.live ??
    (blog
      ? `${LIVE_ORIGIN}${options.route}`
      : isStart
        ? `${LIVE_ORIGIN}/`
        : `${LIVE_ORIGIN}/#!${state}`);
  const localUrl = `${options.local}${options.route}`;
  const slug =
    options.route === "/" ? "home" : options.route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
  const outDir = path.join(process.cwd(), "compare-results", slug);
  await fs.rm(outDir, { recursive: true, force: true });

  console.log(`\n🔎 ${options.route}: ${localUrl} ↔ ${liveUrl}\n`);
  const browser = await chromium.launch();
  const results: Array<{ viewport: string } & Awaited<ReturnType<typeof diffImages>>> = [];
  let liveText = "";
  let localText = "";
  let liveHead = "";
  let localHead = "";

  try {
    const viewports = VIEWPORTS.filter((v) => !options.only || v.name.startsWith(options.only));
    for (const viewport of viewports) {
      const dir = path.join(outDir, viewport.name);
      await fs.mkdir(dir, { recursive: true });
      const live = await capture(
        browser,
        liveUrl,
        viewport,
        options,
        path.join(dir, "live.png"),
        true,
      );
      const local = await capture(
        browser,
        localUrl,
        viewport,
        options,
        path.join(dir, "local.png"),
        false,
      );
      if (!viewport.isMobile) {
        ({ text: liveText, head: liveHead } = live);
        ({ text: localText, head: localHead } = local);
      }
      const result = await diffImages(
        path.join(dir, "live.png"),
        path.join(dir, "local.png"),
        path.join(dir, "diff.png"),
      );
      results.push({ viewport: viewport.name, ...result });
      console.log(
        `  ${viewport.name}: ${result.percent.toFixed(2)} % Pixel abweichend (${result.changed} Px; live ${result.live}, lokal ${result.local})`,
      );
    }

    // Text and head are read with the desktop viewport.
    const desktopNote = viewports.some((v) => !v.isMobile) ? null : "nur mit Desktop-Viewport";

    // Visible text, line by line.
    const visiblePatch = createTwoFilesPatch(
      "live",
      "lokal",
      normalizeLines(liveText) + "\n",
      normalizeLines(localText) + "\n",
    );
    await fs.writeFile(path.join(outDir, "text-visible.diff"), visiblePatch);

    // Head data: title, meta tags, icons, manifest.
    const headPatch = createTwoFilesPatch("live", "lokal", liveHead + "\n", localHead + "\n");
    await fs.writeFile(path.join(outDir, "head.diff"), headPatch);
    const headChanges = headPatch.split("\n").filter((line) => /^[+-][^+-]/.test(line));

    // #content text word by word against the server-rendered live HTML
    // (blog: main#site-content of the WordPress page).
    const container = blog ? "#site-content" : "#content";
    const escaped = await contentText(
      browser,
      blog ? liveUrl : `${LIVE_ORIGIN}/?_escaped_fragment_=${state}`,
      false,
      container,
    );
    const own = await contentText(browser, localUrl, false, container);
    const words = diffWords(normalizeWords(escaped), normalizeWords(own));
    const wordChanges = words.filter((part) => part.added || part.removed);
    await fs.writeFile(
      path.join(outDir, "text-content.diff"),
      wordChanges.length === 0
        ? "Keine Abweichung.\n"
        : words
            .map((part) =>
              part.added ? `{+${part.value}+}` : part.removed ? `[-${part.value}-]` : part.value,
            )
            .join(""),
    );

    const visibleChanges = visiblePatch
      .split("\n")
      .filter((line) => /^[+-][^+-]/.test(line)).length;
    const report = [
      `# Vergleich ${options.route}`,
      "",
      `- lokal: ${localUrl}`,
      `- live: ${liveUrl}`,
      options.clicks.length ? `- Klicks: ${options.clicks.join(", ")}` : "",
      options.hover ? `- Hover: ${options.hover} (nur sichtbarer Bereich)` : "",
      options.liveEval ? `- Auf live ausgeführt: \`${options.liveEval}\`` : "",
      "",
      "| Viewport | Pixel abweichend | Größe live | Größe lokal |",
      "| --- | --- | --- | --- |",
      ...results.map(
        (r) =>
          `| ${r.viewport} | ${r.percent.toFixed(2)} % (${r.changed} Px) | ${r.live} | ${r.local} |`,
      ),
      "",
      `- Sichtbarer Text (text-visible.diff): ${desktopNote ?? `${visibleChanges} geänderte Zeilen`}`,
      blog
        ? `- Text von main#site-content gegen das Server-HTML von live (text-content.diff): ${wordChanges.length} Abweichungen`
        : `- Text von #content gegen ?_escaped_fragment_=${state} (text-content.diff): ${wordChanges.length} Abweichungen`,
      `- Head-Daten (head.diff): ${desktopNote ?? `${headChanges.length} geänderte Zeilen`}`,
      "",
    ]
      .filter((line) => line !== null)
      .join("\n");
    await fs.writeFile(path.join(outDir, "report.md"), report);
    await fs.writeFile(path.join(outDir, "index.html"), html(options.route, results));

    console.log(`  Text sichtbar: ${desktopNote ?? `${visibleChanges} geänderte Zeilen`}`);
    console.log(
      `  Text ${blog ? "main#site-content gegen Server-HTML" : "#content gegen ?_escaped_fragment_"}: ${wordChanges.length} Abweichungen`,
    );
    console.log(`  Head-Daten: ${desktopNote ?? `${headChanges.length} geänderte Zeilen`}`);
    console.log(`\n📁 ${path.relative(process.cwd(), outDir)}/index.html\n`);
  } finally {
    await browser.close();
  }
}

function html(route: string, results: Array<{ viewport: string; percent: number }>) {
  const sections = results
    .map(
      (r) => `<h2>${r.viewport}: ${r.percent.toFixed(2)} %</h2>
<div class="row">${["live", "local", "diff"]
        .map(
          (name) =>
            `<figure><figcaption>${name}</figcaption><img src="${r.viewport}/${name}.png"></figure>`,
        )
        .join("")}</div>`,
    )
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Vergleich ${route}</title>
<style>body{font-family:sans-serif;margin:16px}.row{display:flex;gap:12px;align-items:flex-start}
figure{flex:1;margin:0}img{width:100%;border:1px solid #ccc}</style>
<h1>Vergleich ${route}</h1>
<p><a href="report.md">report.md</a> · <a href="text-visible.diff">text-visible.diff</a> · <a href="text-content.diff">text-content.diff</a> · <a href="head.diff">head.diff</a></p>
${sections}`;
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
