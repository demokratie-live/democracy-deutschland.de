/**
 * Compares the client search of the static blog with the WordPress search.
 *
 *   pnpm compare-blog-search [--refresh] [begriff …]
 *
 * For every term (default: a fixed list of words, phrases, umlauts,
 * stopwords, exclusions and markup terms) it reads the matching posts from
 * the live REST API (`posts?search=`, the same WHERE clause as the search
 * page) and the order from the first live results page, both cached in
 * .cache/blog-import/ (--refresh reads them again), and runs searchPosts()
 * on /blog/search-index.json data.
 *
 * Posts with base64 images in the WordPress source (old newsletters: images
 * now stored as files, and the logo inside the broken logo tag, whose
 * attributes the index drops) can match there by chance ("2021" inside the
 * image data); those differences are listed as "Base64" and do not count
 * (docs/abweichungen.md).
 */
import fs from "fs/promises";
import path from "path";
import { getBlogPosts } from "../src/lib/content/blog";
import { buildSearchIndex } from "../src/lib/blog/search-index";
import { prepareSearch, searchPosts } from "../src/lib/blog/search";

const ORIGIN = "https://democracy-deutschland.de";
const CACHE = path.join(process.cwd(), ".cache/blog-import");

const DEFAULT_TERMS = [
  "wahl",
  "bundestag",
  "spenden",
  "app",
  "grünen",
  "grunen",
  "WÄHLEN",
  "democracy",
  "deutschland",
  "https",
  "uploads",
  "png",
  "reality check",
  '"reality check"',
  "die wahl",
  "ein neues jahr",
  "bundestag abstimmung",
  "weihnachten",
  "2021",
  "-wahl",
  "groß",
  "abstimmung",
  "marius",
  "wp",
  "it's",
];

const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const terms = args.filter((arg) => !arg.startsWith("--"));

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

/** application/x-www-form-urlencoded like the search form sends it. */
function formEncode(term: string) {
  return encodeURIComponent(term).replace(/%20/g, "+");
}

async function main() {
  const [index, posts] = await Promise.all([buildSearchIndex(), getBlogPosts()]);
  const prepared = prepareSearch(index.posts.map((post) => ({ ...post, excerpt: "" })));
  const base64 = new Set(
    posts
      // data: images moved to files, and those inside the broken logo tags of old newsletters.
      .filter(
        (post) =>
          post.content.includes("/blog/wp-content/uploads/inline/") ||
          post.content.includes("base64,"),
      )
      .map((post) => post.frontmatter.wpId),
  );
  let differing = 0;
  for (const term of terms.length ? terms : DEFAULT_TERMS) {
    const rest = JSON.parse(
      await live(
        `${ORIGIN}/blog/wp-json/wp/v2/posts?search=${encodeURIComponent(term)}&per_page=100&_fields=id`,
      ),
    ) as Array<{ id: number }>;
    const liveIds = new Set(rest.map((post) => post.id));
    const page = await live(`${ORIGIN}/blog/?s=${formEncode(term)}`);
    const liveOrder = [...page.matchAll(/<div id="post-(\d+)"/g)].map((match) => Number(match[1]));
    const mine = searchPosts(prepared, term);

    const missing = [...liveIds].filter((id) => !mine.includes(id));
    const extra = mine.filter((id) => !liveIds.has(id));
    const unexpected = [...missing, ...extra].filter((id) => !base64.has(id));
    const expected = [...missing, ...extra].filter((id) => base64.has(id));
    const liveFirst = liveOrder.filter((id) => !base64.has(id) || !missing.includes(id));
    const mineFirst = mine
      .filter((id) => !extra.includes(id) || !base64.has(id))
      .slice(0, liveFirst.length);
    const orderOk = JSON.stringify(liveFirst) === JSON.stringify(mineFirst);

    const label = `${term.padEnd(22)} live ${String(liveIds.size).padStart(2)}, lokal ${String(mine.length).padStart(2)}`;
    const notes = [
      ...(expected.length ? [`Base64: ${expected.join(", ")}`] : []),
      ...(missing.filter((id) => !base64.has(id)).length
        ? [`fehlt: ${missing.filter((id) => !base64.has(id)).join(", ")}`]
        : []),
      ...(extra.filter((id) => !base64.has(id)).length
        ? [`zusätzlich: ${extra.filter((id) => !base64.has(id)).join(", ")}`]
        : []),
      ...(orderOk ? [] : [`Reihenfolge live ${liveFirst.join(",")} lokal ${mineFirst.join(",")}`]),
    ];
    const ok = unexpected.length === 0 && orderOk;
    if (!ok) differing++;
    console.log(`  ${ok ? "✅" : "❌"} ${label}${notes.length ? ` (${notes.join("; ")})` : ""}`);
  }
  const count = (terms.length ? terms : DEFAULT_TERMS).length;
  console.log(`\n${count - differing} von ${count} Suchbegriffen wie live.`);
  if (differing) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
