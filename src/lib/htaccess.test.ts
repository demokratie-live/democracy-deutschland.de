import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHtaccess, type HtaccessInput } from "./htaccess";

const input: HtaccessInput = {
  routes: {
    start: "home",
    routes: [
      { state: "home", path: "/", menu: "home", startpage: true },
      { state: "about", path: "/ueber-uns/", menu: "about", startpage: false },
      { state: "unsubscribe", path: "/unsubscribe/", startpage: false },
    ],
    aliases: [{ from: "/democracy/", to: "/" }],
  },
  appLinks: {
    apk: "https://github.com/x/releases/latest/download/democracy-app.apk",
    aab: "https://github.com/x/releases/latest/download/democracy-app.aab",
  },
  posts: [
    { wpId: 952, permalink: "/blog/2026/06/spendenkonto-zieht-um/" },
    { wpId: 196, permalink: "/blog/2017/12/news-1/" },
  ],
  categories: [{ id: 2, slug: "newsletter" }],
  authors: [{ id: 5, slug: "timo" }],
  basePath: "",
};

const lines = (basePath = "") => buildHtaccess({ ...input, basePath }).split("\n");

test("404 page and noindex outside production", () => {
  const out = lines();
  assert.ok(out.includes("ErrorDocument 404 /404.html"));
  assert.ok(out.includes('  <If "%{HTTP_HOST} !~ /^(www\\.)?democracy-deutschland\\.de$/">'));
  assert.ok(out.includes('    Header always set X-Robots-Tag "noindex, nofollow"'));
});

test("api.php serves the static JSON", () => {
  assert.ok(lines().includes("RewriteRule ^api\\.php$ api/donation_status.json [L]"));
});

test("one redirect per state, unknown states land on the start page", () => {
  const text = lines().join("\n");
  assert.match(
    text,
    /RewriteCond %\{ENV:LEGACY_STATE\} =about\nRewriteRule \^ \/ueber-uns\/\?%\{ENV:LEGACY_QUERY\} \[R=301,L,NE\]/,
  );
  assert.match(
    text,
    /RewriteCond %\{ENV:LEGACY\} =1\nRewriteRule \^ \/\?%\{ENV:LEGACY_QUERY\} \[R=301,L,NE\]/,
  );
});

test("aliases, invite links and app downloads", () => {
  const out = lines();
  assert.ok(out.includes("RewriteRule ^democracy/?$ / [R=301,L]"));
  assert.ok(out.includes("RewriteRule ^invite/([^/]+)/?$ /invite/?code=$1 [B,QSA,R=301,L]"));
  assert.ok(
    out.includes(
      `RewriteRule ^files/download/democracy-app\\.apk$ ${input.appLinks.apk} [R=302,L]`,
    ),
  );
});

test("blog short links in ID order, unknown IDs answer 404", () => {
  const out = lines();
  const first = out.indexOf("RewriteCond %{QUERY_STRING} (?:^|&)p=196(?:&|$)");
  const second = out.indexOf("RewriteCond %{QUERY_STRING} (?:^|&)p=952(?:&|$)");
  assert.ok(first > 0 && second > first);
  assert.equal(
    out[first + 1],
    "RewriteRule ^blog/(?:index\\.php)?$ /blog/2017/12/news-1/? [R=301,L]",
  );
  assert.ok(out.includes("RewriteRule ^blog/(?:index\\.php)?$ - [R=404]"));
  assert.ok(
    out.includes("RewriteRule ^blog/(?:index\\.php)?$ /blog/category/newsletter/? [R=301,L]"),
  );
  assert.ok(out.includes("RewriteRule ^blog/(?:index\\.php)?$ /blog/author/timo/? [R=301,L]"));
});

test("targets carry the basePath, patterns stay relative", () => {
  const out = lines("/sub");
  assert.ok(out.includes("ErrorDocument 404 /sub/404.html"));
  assert.ok(out.includes("RewriteRule ^ /sub/ueber-uns/?%{ENV:LEGACY_QUERY} [R=301,L,NE]"));
  assert.ok(out.includes("RewriteRule ^democracy/?$ /sub/ [R=301,L]"));
  assert.ok(out.includes("RewriteCond %{REQUEST_URI} !^/sub/wahlometer/"));
});

test("WordPress queries, page 1 and feeds", () => {
  const out = lines();
  assert.ok(out.includes("RewriteRule ^blog/(?:index\\.php)?$ /blog/tag/%1/? [R=301,L]"));
  assert.ok(out.includes("RewriteRule ^blog/(?:index\\.php)?$ /blog/%1/%2/? [R=301,L]"));
  assert.ok(out.includes("RewriteRule ^blog/(?:index\\.php)?$ /blog/feed/? [R=301,L]"));
  assert.ok(out.includes("RewriteRule ^(blog/(?:.+/)?)page/1/?$ /$1 [R=301,L]"));
  assert.ok(
    out.includes(
      "RewriteRule ^blog/(?:.+/)?feed/index\\.html$ - [T=application/rss+xml;charset=UTF-8]",
    ),
  );
});
