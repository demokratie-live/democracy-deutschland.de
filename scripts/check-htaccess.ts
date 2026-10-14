/**
 * Checks the server-side rules of out/.htaccess (src/lib/htaccess.ts) against
 * a running Apache: status, Location and Content-Type of every old URL.
 *
 *   pnpm check-htaccess [base-url]        default http://127.0.0.1:3098
 *
 * Works against the local Apache (scripts/serve-apache.sh), the test
 * subdomain on Plesk or, after the switch, production. Redirects are not
 * followed. Exit code 1 when a check fails.
 */
import { getAppLinks, getBlogPosts, getRoutes } from "../src/lib/content";

const base = (process.argv[2] ?? "http://127.0.0.1:3098").replace(/\/$/, "");

interface Check {
  path: string;
  status: number;
  /** Expected Location, relative to the base URL unless absolute. */
  location?: string;
  contentType?: string;
}

async function checks(): Promise<Check[]> {
  const [routes, appLinks, posts] = await Promise.all([getRoutes(), getAppLinks(), getBlogPosts()]);
  const post = posts.at(-1)!;
  const list: Check[] = [
    { path: "/", status: 200, contentType: "text/html; charset=utf-8" },
    { path: "/ueber-uns", status: 301, location: "/ueber-uns/" },
    { path: "/gibtsnicht/", status: 404, contentType: "text/html; charset=utf-8" },
    { path: "/api.php", status: 200, contentType: "application/json" },
    { path: "/api.php?call=donation_status", status: 200, contentType: "application/json" },
    { path: "/api/donation_status.json", status: 200, contentType: "application/json" },
    { path: "/index.php", status: 301, location: "/" },
    { path: "/?page=gibtsnicht", status: 301, location: "/" },
    { path: "/?page=unsubscribe&token=a%2Bb", status: 301, location: "/unsubscribe/?token=a%2Bb" },
    { path: "/?x=1&page=donate&y=2", status: 301, location: "/spenden/?x=1&y=2" },
    { path: "/index.php?page=engineering", status: 301, location: "/engineering/" },
    { path: "/?_escaped_fragment_=faq", status: 301, location: "/faq/" },
    { path: "/%23!donate", status: 301, location: "/#!donate" },
    { path: "/Wahlometer", status: 301, location: "/wahlometer/" },
    { path: "/wahl-o-meter/", status: 301, location: "/wahlometer/" },
    { path: "/wahlometer", status: 301, location: "/wahlometer/" },
    { path: "/wahlometer/", status: 200 },
    { path: "/invite", status: 301, location: "/invite/" },
    { path: "/invite/ABC123", status: 301, location: "/invite/?code=ABC123" },
    { path: "/invite.php?code=ABC123", status: 301, location: "/invite/?code=ABC123" },
    { path: "/files/download/democracy-app.apk", status: 302, location: appLinks.apk },
    { path: "/files/download/democracy-app.aab", status: 302, location: appLinks.aab },
    { path: "/files/download/Satzung_DEMOCRACY.pdf", status: 200, contentType: "application/pdf" },
    { path: `/blog/?p=${post.frontmatter.wpId}`, status: 301, location: post.permalink },
    { path: `/blog/index.php?p=${post.frontmatter.wpId}`, status: 301, location: post.permalink },
    { path: "/blog/?p=999999", status: 404 },
    { path: "/blog/index.php", status: 301, location: "/blog/" },
    { path: post.permalink.replace(/\/$/, ""), status: 301, location: post.permalink },
    {
      path: `/blog/?post_type=post&p=${post.frontmatter.wpId}`,
      status: 301,
      location: post.permalink,
    },
    { path: "/blog/?feed=rss2", status: 301, location: "/blog/feed/" },
    { path: "/blog/feed/atom/", status: 301, location: "/blog/feed/" },
    { path: "/blog/page/1/", status: 301, location: "/blog/" },
    {
      path: "/blog/feed/",
      status: 200,
      contentType: "application/rss+xml;charset=utf-8",
    },
  ];
  for (const route of routes.routes) {
    list.push({ path: `/?page=${route.state}`, status: 301, location: route.path });
  }
  const [year, month] = post.frontmatter.date.split("-");
  list.push(
    { path: `/blog/?m=${year}${month}`, status: 301, location: `/blog/${year}/${month}/` },
    { path: `/blog/?m=${year}`, status: 301, location: `/blog/${year}/` },
  );
  const tag = posts.find((entry) => entry.frontmatter.tags.length)?.frontmatter.tags[0];
  if (tag) list.push({ path: `/blog/?tag=${tag}`, status: 301, location: `/blog/tag/${tag}/` });
  for (const alias of routes.aliases) {
    list.push({ path: alias.from, status: 301, location: alias.to });
  }
  return list;
}

async function main() {
  let failed = 0;
  for (const check of await checks()) {
    const response = await fetch(base + check.path, { redirect: "manual" });
    const location = response.headers.get("location") ?? undefined;
    const contentType = response.headers.get("content-type") ?? undefined;
    const expectedLocation =
      check.location && !/^https?:/.test(check.location) ? base + check.location : check.location;
    const problems = [
      response.status !== check.status && `status ${response.status}, expected ${check.status}`,
      check.location !== undefined &&
        location !== expectedLocation &&
        `Location ${location}, expected ${expectedLocation}`,
      check.contentType !== undefined &&
        contentType?.toLowerCase() !== check.contentType &&
        `Content-Type ${contentType}, expected ${check.contentType}`,
    ].filter(Boolean);
    const robots = response.headers.get("x-robots-tag");
    console.log(
      `${problems.length ? "FAIL" : "ok  "} ${response.status} ${check.path}${location ? ` → ${location}` : ""}${robots ? `  [X-Robots-Tag: ${robots}]` : ""}`,
    );
    for (const problem of problems) console.log(`       ${problem}`);
    if (problems.length) failed++;
  }
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}

main();
