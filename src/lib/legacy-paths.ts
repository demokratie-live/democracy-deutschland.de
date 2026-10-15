import type { AppLinks } from "./schemas";

/**
 * An old path outside the hash router. The states (#!<state>, ?page=<state>)
 * and aliases come from content/site/routes.yaml; these rules cover the
 * rest. They are the single source for both ways of forwarding:
 *
 * - server: buildHtaccess() writes one RewriteRule per rule into out/.htaccess
 *   (Apache on Plesk, 301/302 before any HTML loads)
 * - client: resolveLegacyUrl() in LegacyRedirectScript, which also runs on the
 *   404 page of hosts without .htaccess (GitHub Pages, `serve out`)
 *
 * tests/legacy-urls.ts lists the concrete old URLs both ways are tested with.
 */
export interface LegacyPathRule {
  /** Why the old path exists; written as comment into out/.htaccess. */
  comment: string;
  /**
   * Regular expression for the path relative to the site root (no leading
   * slash, no basePath), anchored at both ends. Only syntax that JavaScript
   * and Apache (PCRE) read the same way: literals, `[^/]`, `?`, `+`, `|`,
   * `(…)`, `(?:…)`. The browser matches the URL-encoded path, Apache the
   * decoded one: keep patterns ASCII.
   */
  from: string;
  /**
   * New path (gets the basePath) or absolute URL. `$1`… insert the groups of
   * `from` (empty when a group did not match); they may only go into the
   * path, not into a query string.
   */
  to: string;
  /** 302 for targets that move (GitHub's "latest" release); default 301. */
  status?: 301 | 302;
  /** Match regardless of case (Apache `NC`, JavaScript `i`). */
  ignoreCase?: boolean;
  /** Drop the old query string; by default it is passed on. */
  dropQuery?: boolean;
}

/** Compact form of a rule for the inline script (resolveLegacyUrl()). */
export interface LegacyPathEntry {
  from: string;
  to: string;
  i?: 1;
  q?: 1;
}

export function legacyPathRules(appLinks: Pick<AppLinks, "apk" | "aab">): LegacyPathRule[] {
  return [
    {
      comment: "Old entry point /index.php (index.php?page=<state> goes with the states)",
      from: "index\\.php",
      to: "/",
    },
    {
      comment:
        "Tester sign-up of the old site (old .htaccess: invite, invite/<code> → invite.php?code=).\n" +
        "It is gone, links from /engineering/, blog posts and mails land on the start page.",
      from: "invite(?:\\.php|/[^/]*/?)?",
      to: "/",
      dropQuery: true,
    },
    {
      comment: "Spellings of the Wahl-O-Meter (/Wahlometer, /wahl-o-meter, …)",
      from: "wahl-?o-?meter/?",
      to: "/wahlometer/",
      ignoreCase: true,
    },
    {
      comment: "Old APK download → GitHub release (302: “latest” moves with every release)",
      from: "files/download/democracy-app\\.apk",
      to: appLinks.apk,
      status: 302,
    },
    {
      comment: "Old AAB download → GitHub release",
      from: "files/download/democracy-app\\.aab",
      to: appLinks.aab,
      status: 302,
    },
    {
      comment: "WordPress entry point /blog/index.php (its queries ?p=, ?cat= … are handled above)",
      from: "blog/index\\.php",
      to: "/blog/",
    },
    {
      comment: "Page 1 of a list is the list itself: /blog/page/1/, /blog/category/<slug>/page/1/",
      from: "blog/(.+/)?page/1/?",
      to: "/blog/$1",
    },
    {
      comment: "Only RSS 2.0 exists statically; Atom and RDF feeds forward to it",
      from: "blog/((?:.+/)?)feed/(?:atom|rdf|rss2?)/?",
      to: "/blog/$1feed/",
    },
  ];
}

export function toLegacyPathEntries(rules: LegacyPathRule[]): LegacyPathEntry[] {
  return rules.map((rule) => ({
    from: rule.from,
    to: rule.to,
    ...(rule.ignoreCase ? { i: 1 as const } : {}),
    ...(rule.dropQuery ? { q: 1 as const } : {}),
  }));
}
