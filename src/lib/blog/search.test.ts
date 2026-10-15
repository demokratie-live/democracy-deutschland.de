import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSearchIndex } from "./search-index";
import {
  foldForSearch,
  parseSearch,
  prepareSearch,
  searchPosts,
  searchQuery,
  type SearchDocument,
} from "./search";

test("search terms like parse_search(): stopwords, short terms, phrases", () => {
  assert.deepEqual(parseSearch("die wahl"), { terms: ["wahl"], count: 2 });
  assert.deepEqual(parseSearch('"reality check"'), { terms: ["reality check"], count: 1 });
  assert.deepEqual(parseSearch("a wahl -"), { terms: ["wahl"], count: 3 });
  // Only stopwords: the whole string as one sentence.
  assert.deepEqual(parseSearch("die das"), { terms: ["die das"], count: 2 });
  assert.deepEqual(parseSearch(" "), { terms: [" "], count: 1 });
});

test("the collation ignores case and diacritics", () => {
  assert.equal(foldForSearch("WÄHLEN"), foldForSearch("wahlen"));
  assert.equal(foldForSearch("Grünen"), "grunen");
  assert.notEqual(foldForSearch("groß"), foldForSearch("gross"));
});

const docs: SearchDocument[] = [
  {
    id: 1,
    date: "2024-01-01T00:00:00",
    title: "Alt",
    excerpt: "",
    content: "<p>Wahl und Bundestag</p>",
  },
  {
    id: 2,
    date: "2025-01-01T00:00:00",
    title: "Wahlprogramm",
    excerpt: "",
    content: "<p>Text</p>",
  },
  { id: 3, date: "2026-01-01T00:00:00", title: "Neu", excerpt: "", content: "<p>die Wahl</p>" },
  { id: 4, date: "2026-02-01T00:00:00", title: "Ohne", excerpt: "", content: '<img src="x.png">' },
];
const search = (s: string) => searchPosts(prepareSearch(docs), s);

test("one term: title matches first, then newest", () => {
  assert.deepEqual(search("wahl"), [2, 3, 1]);
  assert.deepEqual(search("png"), [4]);
  assert.deepEqual(search("-wahl"), [4]);
  assert.deepEqual(search(""), [4, 3, 2, 1]);
});

test("several terms: sentence in title, all words in title, sentence in content, rest", () => {
  assert.deepEqual(search("wahl bundestag"), [1]);
  assert.deepEqual(search("die wahl"), [2, 3, 1]);
});

test("page links rebuild the query like urlencode()", () => {
  assert.equal(searchQuery("die wahl"), "?s=die+wahl");
  assert.equal(searchQuery(""), "?s");
  assert.equal(searchQuery("wählen!"), "?s=w%C3%A4hlen%21");
});

test("the index of all posts finds what the live search finds (page 1, 2026-10-13)", async () => {
  const index = await buildSearchIndex();
  const prepared = prepareSearch(index.posts.map((post) => ({ ...post, excerpt: "" })));
  const first = (s: string) => searchPosts(prepared, s).slice(0, 10);
  assert.deepEqual(first("wahl"), [816, 916, 914, 912, 908, 906, 898, 935, 800, 808]);
  assert.deepEqual(first("die wahl"), [816, 916, 914, 912, 908, 906, 898, 843, 851, 873]);
  assert.deepEqual(first("reality check"), [851, 916, 914, 912, 908, 906, 898, 843, 873, 918]);
  assert.deepEqual(
    first("bundestag abstimmung"),
    [800, 808, 816, 851, 854, 862, 887, 895, 916, 914],
  );
  assert.deepEqual(first("ein neues jahr"), [952, 884, 906, 371, 323, 265]);
  assert.deepEqual(first("xyzxyzq"), []);
});
