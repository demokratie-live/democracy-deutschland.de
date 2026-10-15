/**
 * Checks the server-side rules of out/.htaccess (src/lib/htaccess.ts) against
 * a running Apache: status, Location and Content-Type of every old URL of
 * tests/legacy-urls.ts (the same table the client-side Playwright tests use)
 * plus the answers that are not redirects (pages, 404, app JSON, feeds).
 *
 *   pnpm check-htaccess [base-url]        default http://127.0.0.1:3098
 *
 * Works against the local Apache (scripts/serve-apache.sh), the test
 * subdomain on Plesk or, after the switch, production. Redirects are not
 * followed. Exit code 1 when a check fails.
 */
import { legacyUrls } from "../tests/legacy-urls";

const base = (process.argv[2] ?? "http://127.0.0.1:3098").replace(/\/$/, "");

interface Check {
  path: string;
  status: number;
  /** Expected Location, relative to the base URL unless absolute. */
  location?: string;
  contentType?: string;
}

function checks(): Check[] {
  const html = "text/html; charset=utf-8";
  const json = "application/json";
  const list: Check[] = [
    { path: "/", status: 200, contentType: html },
    { path: "/gibtsnicht/", status: 404, contentType: html },
    { path: "/wahlometer/", status: 200, contentType: html },
    { path: "/api.php", status: 200, contentType: json },
    { path: "/api.php?call=donation_status", status: 200, contentType: json },
    { path: "/api/donation_status.json", status: 200, contentType: json },
    { path: "/files/download/Satzung_DEMOCRACY.pdf", status: 200, contentType: "application/pdf" },
    { path: "/blog/feed/", status: 200, contentType: "application/rss+xml;charset=utf-8" },
  ];
  for (const entry of legacyUrls()) {
    if (!entry.server) continue;
    const { status, location } = entry.server;
    list.push({
      path: entry.from,
      status,
      location: status === 301 || status === 302 ? (location ?? entry.to ?? undefined) : undefined,
    });
  }
  return list;
}

async function main() {
  let failed = 0;
  for (const check of checks()) {
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
