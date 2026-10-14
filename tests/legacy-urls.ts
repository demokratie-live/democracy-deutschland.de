/**
 * Every kind of old URL of the PHP site and the WordPress blog with the place
 * a visitor ends up. The binding list for both ways of forwarding:
 *
 * - server: `pnpm check-htaccess [url]` requests each `from` from Apache with
 *   out/.htaccess (Plesk, `pnpm serve-apache`) and checks the first answer
 * - client: tests/e2e/legacy-urls.spec.ts and tests/basepath/legacy-urls.spec.ts
 *   open each `from` on a static host without .htaccess (`serve out`, the
 *   basePath server) and check where the browser ends up
 *
 * The rules themselves come from content/site/routes.yaml (states, aliases)
 * and src/lib/legacy-paths.ts. Expected values are read from content/.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import yaml from "yaml";
import { blogPermalink } from "../src/lib/content/blog";

export interface LegacyUrl {
  /** Origin of the old URL; prefix of the test name. */
  group: string;
  /** Old URL relative to the site root: path, query, hash. */
  from: string;
  /**
   * Where the visitor ends up: a path relative to the site root (gets the
   * basePath) or an absolute URL; null for the 404 page. Equal to `from` for
   * pages and files that still exist.
   */
  to: string | null;
  /**
   * First answer of Apache with out/.htaccess: status and, for redirects, the
   * Location (default `to`). Missing for hash URLs: the hash never reaches
   * the server.
   */
  server?: { status: 200 | 301 | 302 | 404; location?: string };
  /**
   * Hosts without .htaccess: by default the browser opens `from` and must end
   * on `to`; "file" requests it and checks the status (200, or 404 when `to`
   * is null); false: only Apache forwards it (see docs/abweichungen.md).
   */
  client?: "file" | false;
}

const CONTENT = path.join(process.cwd(), "content");
const readYaml = <T>(file: string) =>
  yaml.parse(fs.readFileSync(path.join(CONTENT, file), "utf-8")) as T;

/** Fake newsletter token (sha1 length); never a real one. */
export const FAKE_TOKEN = "0123456789abcdef0123456789abcdef01234567";

export function legacyUrls(): LegacyUrl[] {
  const routes = readYaml<{
    start: string;
    routes: { state: string; path: string }[];
    aliases: { from: string; to: string }[];
  }>("site/routes.yaml");
  const appLinks = readYaml<{ apk: string; aab: string }>("site/app-links.yaml");
  const taxonomy = readYaml<{
    authors: { id: number; slug: string }[];
    categories: { id: number; slug: string }[];
  }>("blog/taxonomy.yaml");
  const posts = fs
    .readdirSync(path.join(CONTENT, "blog"))
    .filter((file) => file.endsWith(".md"))
    .map((file) => matter(fs.readFileSync(path.join(CONTENT, "blog", file), "utf-8")).data)
    .map((data) => ({
      wpId: data.wpId as number,
      date: data.date as string,
      tags: data.tags as string[],
      permalink: blogPermalink({ date: data.date, slug: data.slug }),
    }))
    .sort((a, b) => a.wpId - b.wpId);
  const post = posts[0];
  const tag = posts.find((entry) => entry.tags.length)!.tags[0];
  const [year, month] = post.date.split("-");
  const pathOf = (state: string) => routes.routes.find((route) => route.state === state)!.path;
  const start = pathOf(routes.start);
  const redirect = (location?: string) => ({ status: 301 as const, location });

  const list: LegacyUrl[] = [];
  for (const { state, path: to } of routes.routes) {
    list.push(
      { group: "Hash-Router", from: `/#!${state}`, to },
      { group: "Seiten-Parameter", from: `/?page=${state}`, to, server: redirect() },
      { group: "Crawler-URL", from: `/?_escaped_fragment_=${state}`, to, server: redirect() },
    );
  }
  for (const alias of routes.aliases) {
    list.push(
      { group: "Alias", from: alias.from, to: alias.to, server: redirect() },
      { group: "Alias", from: alias.from.replace(/\/$/, ""), to: alias.to, server: redirect() },
    );
  }

  const invite = { to: start, server: redirect() };
  list.push(
    // Hash router and page parameters with anchors, variables and other parameters
    { group: "Hash-Router", from: "/#!engineering#help", to: "/engineering/#help" },
    {
      group: "Hash-Router",
      from: "/#!wahlometer#wom-campaign-container",
      to: "/wahlometer/#wom-campaign-container",
    },
    { group: "Hash-Router", from: "/#!gibt-es-nicht", to: start },
    {
      group: "Newsletter-Abmeldung",
      from: `/#!unsubscribe;token.${FAKE_TOKEN}`,
      to: `${pathOf("unsubscribe")}?token=${FAKE_TOKEN}`,
    },
    {
      group: "Newsletter-Abmeldung",
      from: `/?page=unsubscribe&token=${FAKE_TOKEN}`,
      to: `${pathOf("unsubscribe")}?token=${FAKE_TOKEN}`,
      server: redirect(),
    },
    {
      group: "Newsletter-Abmeldung",
      from: "/?page=unsubscribe&token=a%2Bb",
      to: `${pathOf("unsubscribe")}?token=a%2Bb`,
      server: redirect(),
    },
    {
      group: "Newsletter-Abmeldung",
      from: `${pathOf("unsubscribe")}?token=${FAKE_TOKEN}`,
      to: `${pathOf("unsubscribe")}?token=${FAKE_TOKEN}`,
      server: { status: 200 },
    },
    {
      group: "Seiten-Parameter",
      from: "/?x=1&page=donate&y=2",
      to: `${pathOf("donate")}?x=1&y=2`,
      server: redirect(),
    },
    { group: "Seiten-Parameter", from: "/?page=gibtsnicht", to: start, server: redirect() },
    {
      group: "Seiten-Parameter",
      from: "/index.php?page=engineering",
      to: pathOf("engineering"),
      server: redirect(),
    },
    { group: "Einstieg", from: "/index.php", to: "/", server: redirect() },
    { group: "Einstieg", from: "/ueber-uns", to: "/ueber-uns/", server: redirect() },

    // Old .htaccess of the PHP site
    {
      group: "Alte .htaccess",
      from: "/%23!donate",
      to: pathOf("donate"),
      server: redirect("/#!donate"),
    },
    { group: "Alte .htaccess", from: "/invite", ...invite },
    { group: "Alte .htaccess", from: "/invite/", ...invite },
    { group: "Alte .htaccess", from: "/invite/C1B381E2", ...invite },
    { group: "Alte .htaccess", from: "/invite/AB296297/", ...invite },
    { group: "Alte .htaccess", from: "/invite.php", ...invite },
    { group: "Alte .htaccess", from: "/invite.php?code=C1B381E2", ...invite },
    { group: "Alte .htaccess", from: "/sai", to: null, server: { status: 404 } },
    {
      group: "Alte .htaccess",
      from: "/cache/10/16047cd8e019ce35cceeda487343c102be7bef8d",
      to: null,
      server: { status: 404 },
    },
    {
      group: "Alte .htaccess",
      from: "/invite/cache/10/16047cd8e019ce35cceeda487343c102be7bef8d",
      to: null,
      server: { status: 404 },
    },
    {
      group: "Alte .htaccess",
      from: "/cache/webfonts/fa-solid-900.woff2",
      to: null,
      server: { status: 404 },
      client: "file",
    },

    // Spellings
    ...["/Wahlometer", "/wahl-o-meter/", "/wahlometer", "/WAHL-O-METER"].map((from) => ({
      group: "Schreibweise",
      from,
      to: pathOf("wahlometer"),
      server: redirect(),
    })),

    // Files (old files API: /files/<category>/<name>)
    {
      group: "Download",
      from: "/files/download/democracy-app.apk",
      to: appLinks.apk,
      server: { status: 302 },
    },
    {
      group: "Download",
      from: "/files/download/democracy-app.aab",
      to: appLinks.aab,
      server: { status: 302 },
    },
    ...[
      "/files/download/Satzung_DEMOCRACY.pdf",
      "/files/download/RADIO_FRITZ_TRACKBACK_SAMSTAG_06.10.2018.mp3",
      "/files/images/forfb2.png",
    ].map((from) => ({
      group: "Datei",
      from,
      to: from,
      server: { status: 200 as const },
      client: "file" as const,
    })),
    // Not linked anywhere any more (decision Manuel 2026-10-14)
    {
      group: "Datei",
      from: "/files/download/StartUpValley.pdf",
      to: null,
      server: { status: 404 },
      client: "file",
    },

    // Files in the root of the old site
    ...[
      "/favicon.ico",
      "/manifest.json",
      "/apple-touch-icon.png",
      "/android-chrome-192x192.png",
      "/android-chrome-512x512.png",
      "/favicon-16x16.png",
      "/favicon-32x32.png",
      "/browserconfig.xml",
      "/site.webmanifest",
      "/logo.png",
    ].map((from) => ({
      group: "Wurzel",
      from,
      to: from,
      server: { status: 200 as const },
      client: "file" as const,
    })),
    ...["/maintenance.html", "/ms-icon-144x144.png"].map((from) => ({
      group: "Wurzel",
      from,
      to: null,
      server: { status: 404 as const },
      client: "file" as const,
    })),

    // WordPress
    { group: "WordPress", from: `/blog/?p=${post.wpId}`, to: post.permalink, server: redirect() },
    {
      group: "WordPress",
      from: `/blog/?post_type=post&p=${post.wpId}`,
      to: post.permalink,
      server: redirect(),
    },
    {
      group: "WordPress",
      from: `/blog/index.php?p=${post.wpId}`,
      to: post.permalink,
      server: redirect(),
    },
    { group: "WordPress", from: "/blog/?p=999999", to: null, server: { status: 404 } },
    { group: "WordPress", from: "/blog/index.php", to: "/blog/", server: redirect() },
    {
      group: "WordPress",
      from: post.permalink.replace(/\/$/, ""),
      to: post.permalink,
      server: redirect(),
    },
    { group: "WordPress", from: "/blog/page/1/", to: "/blog/", server: redirect() },
    {
      group: "WordPress",
      from: "/blog/category/newsletter/page/1/",
      to: "/blog/category/newsletter/",
      server: redirect(),
    },
    { group: "WordPress", from: "/blog/feed/atom/", to: "/blog/feed/", server: redirect() },
    {
      group: "WordPress",
      from: `/blog/tag/${tag}/feed/rdf/`,
      to: `/blog/tag/${tag}/feed/`,
      server: redirect(),
    },
    { group: "WordPress", from: "/blog/2021/08/09/", to: null, server: { status: 404 } },
    // Query forms WordPress only creates without pretty permalinks; nowhere
    // linked on live, so only Apache forwards them.
    ...[
      [`/blog/?cat=${taxonomy.categories[0].id}`, `/blog/category/${taxonomy.categories[0].slug}/`],
      [`/blog/?author=${taxonomy.authors[0].id}`, `/blog/author/${taxonomy.authors[0].slug}/`],
      [`/blog/?tag=${tag}`, `/blog/tag/${tag}/`],
      [`/blog/?m=${year}${month}`, `/blog/${year}/${month}/`],
      [`/blog/?m=${year}`, `/blog/${year}/`],
      ["/blog/?feed=rss2", "/blog/feed/"],
    ].map(([from, to]) => ({
      group: "WordPress",
      from,
      to,
      server: redirect(),
      client: false as const,
    })),

    { group: "404", from: "/gibtsnicht/", to: null, server: { status: 404 } },
  );
  return list;
}
