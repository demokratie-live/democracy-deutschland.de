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
 *   --no-mask          <video> und <iframe> nicht abdecken
 *   --viewport-only    nur den sichtbaren Bereich statt der ganzen Seite
 *
 * Ergebnis unter compare-results/<slug>/:
 *   <viewport>/live.png, local.png, diff.png  (1280 px Desktop, 375 px Mobil)
 *   text-visible.diff   sichtbarer Text (innerText) live gegen lokal, Desktop
 *   text-content.diff   Text von #content: ?_escaped_fragment_=<state> gegen lokal
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
const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 800, isMobile: false },
  { name: "mobile-375", width: 375, height: 812, isMobile: true },
];

interface Options {
  route: string;
  local: string;
  live?: string;
  clicks: string[];
  mask: boolean;
  fullPage: boolean;
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
    else if (arg === "--no-mask") options.mask = false;
    else if (arg === "--viewport-only") options.fullPage = false;
    else if (!arg.startsWith("--")) options.route = arg;
    else throw new Error(`Unbekannte Option: ${arg}`);
  }
  if (!options.route) {
    throw new Error("Pfad fehlt, z.B. `pnpm compare /wahlometer/`");
  }
  if (!options.route.endsWith("/")) options.route += "/";
  options.local = options.local.replace(/\/$/, "");
  return options;
}

async function loadState(route: string) {
  const raw = await fs.readFile(path.join(process.cwd(), "content/site/routes.yaml"), "utf-8");
  const routes = routesSchema.parse(yaml.parse(raw));
  const entry = routes.routes.find((r) => r.path === route);
  if (!entry) throw new Error(`Pfad ${route} fehlt in content/site/routes.yaml`);
  return { state: entry.state, isStart: entry.state === routes.start };
}

/** Wait until the page (live: after the hash router loaded #content) is settled. */
async function settle(page: Page) {
  await page.waitForFunction(() => (document.querySelector("#content")?.children.length ?? 0) > 0, {
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.evaluate(async () => {
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
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  await settle(page);
  for (const selector of options.clicks) {
    await page.locator(selector).first().click();
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  }
  await page.screenshot({
    path: file,
    fullPage: options.fullPage,
    animations: "disabled",
    mask: options.mask ? [page.locator("video"), page.locator("iframe")] : [],
  });
  const text = viewport.isMobile ? "" : await page.evaluate(() => document.body.innerText);
  await context.close();
  return text;
}

/** Text of #content without scripts; for live from the server-rendered HTML. */
async function contentText(browser: Browser, url: string, javaScriptEnabled: boolean) {
  const context = await browser.newContext({ javaScriptEnabled });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  // Text nodes joined with spaces: the templates have whitespace between
  // block elements, JSX has not; that difference is not visible. Passed as a
  // string because tsx (esbuild) wraps nested functions in a __name helper.
  const text = await page.evaluate<string>(`(() => {
    const content = document.querySelector("#content");
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
  const liveUrl = options.live ?? (isStart ? `${LIVE_ORIGIN}/` : `${LIVE_ORIGIN}/#!${state}`);
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

  try {
    for (const viewport of VIEWPORTS) {
      const dir = path.join(outDir, viewport.name);
      await fs.mkdir(dir, { recursive: true });
      const live = await capture(browser, liveUrl, viewport, options, path.join(dir, "live.png"));
      const local = await capture(
        browser,
        localUrl,
        viewport,
        options,
        path.join(dir, "local.png"),
      );
      if (!viewport.isMobile) {
        liveText = live;
        localText = local;
      }
      const result = await diffImages(
        path.join(dir, "live.png"),
        path.join(dir, "local.png"),
        path.join(dir, "diff.png"),
      );
      results.push({ viewport: viewport.name, ...result });
      console.log(
        `  ${viewport.name}: ${result.percent.toFixed(2)} % Pixel abweichend (live ${result.live}, lokal ${result.local})`,
      );
    }

    // Visible text, line by line.
    const visiblePatch = createTwoFilesPatch(
      "live",
      "lokal",
      normalizeLines(liveText) + "\n",
      normalizeLines(localText) + "\n",
    );
    await fs.writeFile(path.join(outDir, "text-visible.diff"), visiblePatch);

    // #content text word by word against the server-rendered live HTML.
    const escaped = await contentText(
      browser,
      `${LIVE_ORIGIN}/?_escaped_fragment_=${state}`,
      false,
    );
    const own = await contentText(browser, localUrl, false);
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
      "",
      "| Viewport | Pixel abweichend | Größe live | Größe lokal |",
      "| --- | --- | --- | --- |",
      ...results.map(
        (r) => `| ${r.viewport} | ${r.percent.toFixed(2)} % | ${r.live} | ${r.local} |`,
      ),
      "",
      `- Sichtbarer Text (text-visible.diff): ${visibleChanges} geänderte Zeilen`,
      `- Text von #content gegen ?_escaped_fragment_=${state} (text-content.diff): ${wordChanges.length} Abweichungen`,
      "",
    ]
      .filter((line) => line !== null)
      .join("\n");
    await fs.writeFile(path.join(outDir, "report.md"), report);
    await fs.writeFile(path.join(outDir, "index.html"), html(options.route, results));

    console.log(`  Text sichtbar: ${visibleChanges} geänderte Zeilen`);
    console.log(`  Text #content gegen ?_escaped_fragment_: ${wordChanges.length} Abweichungen`);
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
<p><a href="report.md">report.md</a> · <a href="text-visible.diff">text-visible.diff</a> · <a href="text-content.diff">text-content.diff</a></p>
${sections}`;
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
