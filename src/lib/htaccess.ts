import type { Routes } from "./schemas";

/** Data the generated .htaccess is built from (see src/app/(site)/.htaccess/route.ts). */
export interface HtaccessInput {
  routes: Routes;
  /** content/site/app-links.yaml `apk` and `aab` (GitHub release downloads). */
  appLinks: { apk: string; aab: string };
  /** Blog posts: WordPress ID and permalink /blog/<year>/<month>/<slug>/. */
  posts: { wpId: number; permalink: string }[];
  /** WordPress IDs of categories and authors with their archive paths. */
  categories: { id: number; slug: string }[];
  authors: { id: number; slug: string }[];
  basePath: string;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Path of a route as RewriteRule pattern: relative to the .htaccess directory. */
function pattern(path: string): string {
  return escapeRegex(path.replace(/^\/+/, ""));
}

/**
 * out/.htaccess for Apache 2.4 (Plesk): server-side 301 redirects for the old
 * URLs of the PHP site and of WordPress, the 404 page, noindex outside
 * production and the app JSON under /api.php. Hosts without .htaccess
 * (GitHub Pages, `serve out`) ignore the file; there the client-side
 * redirects (LegacyRedirectScript, [...alias]) do the same in the browser.
 *
 * Hash links (#!<state>) never reach the server and stay client-side.
 */
export function buildHtaccess(input: HtaccessInput): string {
  const { routes, appLinks, posts, categories, authors, basePath } = input;
  const to = (path: string) => `${basePath}${path}`;
  const lines: string[] = [];
  const add = (...block: string[]) => lines.push(...block, "");

  add(
    "# Generated at build time by src/lib/htaccess.ts from content/site/routes.yaml,",
    "# content/site/app-links.yaml and content/blog/. Do not edit the exported file.",
    "# Apache 2.4 (Plesk). Hosts without .htaccess use the client-side redirects.",
  );
  add(
    `ErrorDocument 404 ${to("/404.html")}`,
    "# Live sends text/html; charset=UTF-8.",
    "AddDefaultCharset utf-8",
  );
  add(
    "<IfModule mod_headers.c>",
    "  # Only the production host may be indexed.",
    '  <If "%{HTTP_HOST} !~ /^(www\\.)?democracy-deutschland\\.de$/">',
    '    Header always set X-Robots-Tag "noindex, nofollow"',
    "  </If>",
    "  # The app reads the donation status on every start: always revalidate.",
    '  <Files "donation_status.json">',
    '    Header set Cache-Control "no-cache"',
    "  </Files>",
    "</IfModule>",
  );

  add("RewriteEngine On");

  add(
    "# App (democracy-client): /api.php?call=donation_status serves the static JSON",
    "# as application/json, whether PHP is enabled or not.",
    "RewriteRule ^api\\.php$ api/donation_status.json [L]",
  );

  add(
    "# Encoded hash in old app links (democracy-client#1142): /%23!<state> → /#!<state>",
    `RewriteRule ^(.*)#(.*)$ ${to("/$1#$2")} [R=301,L,NE]`,
  );

  // ?page=<state> / ?_escaped_fragment_=<state>: first take the state and the
  // remaining query apart, then one redirect per state (resolveLegacyUrl()).
  add(
    "# Old page parameter on / and /index.php: ?page=<state>, ?_escaped_fragment_=<state>.",
    "# Other parameters stay: ?page=unsubscribe&token=X → /unsubscribe/?token=X.",
    "RewriteCond %{QUERY_STRING} ^(?:page|_escaped_fragment_)=([^&]*)(?:&(.*))?$",
    "RewriteRule ^(?:index\\.php)?$ - [E=LEGACY:1,E=LEGACY_STATE:%1,E=LEGACY_QUERY:%2]",
    "RewriteCond %{ENV:LEGACY} !=1",
    "RewriteCond %{QUERY_STRING} ^(.+?)&(?:page|_escaped_fragment_)=([^&]*)(&.*)?$",
    "RewriteRule ^(?:index\\.php)?$ - [E=LEGACY:1,E=LEGACY_STATE:%2,E=LEGACY_QUERY:%1%3]",
  );
  for (const route of routes.routes) {
    add(
      `RewriteCond %{ENV:LEGACY_STATE} =${route.state}`,
      `RewriteRule ^ ${to(route.path)}?%{ENV:LEGACY_QUERY} [R=301,L,NE]`,
    );
  }
  const start = routes.routes.find((route) => route.state === routes.start)?.path ?? "/";
  add(
    "# Unknown states land on the start page like live.",
    "RewriteCond %{ENV:LEGACY} =1",
    `RewriteRule ^ ${to(start)}?%{ENV:LEGACY_QUERY} [R=301,L,NE]`,
    `RewriteRule ^index\\.php$ ${to("/")} [R=301,L]`,
  );

  if (routes.aliases.length > 0) {
    add(
      "# Aliases (routes.yaml)",
      ...routes.aliases.map(
        (alias) =>
          `RewriteRule ^${pattern(alias.from).replace(/\/$/, "")}/?$ ${to(alias.to)} [R=301,L]`,
      ),
    );
  }

  add(
    "# Spellings of the Wahl-O-Meter (/Wahlometer, /wahl-o-meter, …)",
    `RewriteCond %{REQUEST_URI} !^${escapeRegex(to("/wahlometer/"))}`,
    `RewriteRule ^wahl-?o-?meter/?$ ${to("/wahlometer/")} [NC,R=301,L]`,
  );

  add(
    "# Invite links from old e-mails (old .htaccess: invite/<code>, invite → invite.php)",
    `RewriteRule ^invite\\.php$ ${to("/invite/")} [R=301,L]`,
    `RewriteRule ^invite$ ${to("/invite/")} [R=301,L]`,
    `RewriteRule ^invite/([^/]+)/?$ ${to("/invite/")}?code=$1 [B,QSA,R=301,L]`,
  );

  add(
    "# Old APK/AAB downloads → GitHub releases (302: “latest” moves with every release)",
    `RewriteRule ^files/download/democracy-app\\.apk$ ${appLinks.apk} [R=302,L]`,
    `RewriteRule ^files/download/democracy-app\\.aab$ ${appLinks.aab} [R=302,L]`,
  );

  const blogIndex = "^blog/(?:index\\.php)?$";
  const shortLink = (key: string, id: number, path: string) => [
    `RewriteCond %{QUERY_STRING} (?:^|&)${key}=${id}(?:&|$)`,
    `RewriteRule ${blogIndex} ${to(path)}? [R=301,L]`,
  ];
  add(
    "# WordPress short links /blog/?p=<id>, ?cat=<id>, ?author=<id> → permalinks (301 like WordPress)",
    ...[...posts]
      .sort((a, b) => a.wpId - b.wpId)
      .flatMap((post) => shortLink("p", post.wpId, post.permalink)),
    "# Unknown post IDs: 404 like WordPress",
    "RewriteCond %{QUERY_STRING} (?:^|&)p=[0-9]+(?:&|$)",
    `RewriteRule ${blogIndex} - [R=404]`,
    ...categories.flatMap((term) => shortLink("cat", term.id, `/blog/category/${term.slug}/`)),
    ...authors.flatMap((term) => shortLink("author", term.id, `/blog/author/${term.slug}/`)),
    "# ?tag=<slug>, ?m=<yyyymm>, ?m=<yyyy> and ?feed=… like WordPress",
    "RewriteCond %{QUERY_STRING} (?:^|&)tag=([a-z0-9-]+)(?:&|$)",
    `RewriteRule ${blogIndex} ${to("/blog/tag/%1/")}? [R=301,L]`,
    "RewriteCond %{QUERY_STRING} (?:^|&)m=([0-9]{4})([0-9]{2})(?:&|$)",
    `RewriteRule ${blogIndex} ${to("/blog/%1/%2/")}? [R=301,L]`,
    "RewriteCond %{QUERY_STRING} (?:^|&)m=([0-9]{4})(?:&|$)",
    `RewriteRule ${blogIndex} ${to("/blog/%1/")}? [R=301,L]`,
    "RewriteCond %{QUERY_STRING} (?:^|&)feed=(?:rss2?|atom|rdf)(?:&|$)",
    `RewriteRule ${blogIndex} ${to("/blog/feed/")}? [R=301,L]`,
    `RewriteRule ^blog/index\\.php$ ${to("/blog/")} [R=301,L]`,
  );

  add(
    "# Page 1 of a list is the list itself: /blog/page/1/, /blog/category/<slug>/page/1/",
    `RewriteRule ^(blog/(?:.+/)?)page/1/?$ ${to("/$1")} [R=301,L]`,
    "# Feeds: the export writes …/feed/index.html; serve it as RSS like WordPress. Only RSS 2.0",
    "# exists, Atom and RDF forward to it.",
    `RewriteRule ^(blog/(?:.+/)?feed)/(?:atom|rdf|rss2?)/?$ ${to("/$1/")} [R=301,L]`,
    "RewriteRule ^blog/(?:.+/)?feed/index\\.html$ - [T=application/rss+xml;charset=UTF-8]",
  );

  return lines.join("\n");
}
