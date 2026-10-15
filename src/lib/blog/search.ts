/**
 * The search of WordPress 7.1 (WP_Query::parse_search(), parse_search_terms(),
 * parse_search_order()) for the client: which posts match `s` and in which
 * order. MySQL compares with LIKE '%term%' in a case- and accent-insensitive
 * collation (utf8mb4_unicode_ci: "wahl" finds "Wählen").
 */

/**
 * Global under which the head script keeps the style sheet that hides the
 * content column until the results render. A constructed sheet adds no node
 * to <head>, which React hydrates node by node.
 */
export const SEARCH_PENDING_SHEET = "__blogSearchPending";

/** Stopwords of the German translation (de_DE.po, "Comma-separated list of search stopwords"). */
export const SEARCH_STOPWORDS = new Set(
  "ein,eine,einer,der,die,das,und,oder,doch,sind,ist,war,für,von,in,an,zu,über,mit,dies,diese,diesen,dieser,wer,wo,wie,was,www,nicht".split(
    ",",
  ),
);

export interface SearchDocument {
  id: number;
  /** post_date, local time: newer first among equals. */
  date: string;
  /** post_title (raw). */
  title: string;
  /** post_excerpt (raw; empty for automatic excerpts). */
  excerpt: string;
  /** post_content as HTML. */
  content: string;
}

/** Characters the collation compares equal: case and diacritics; ignorable code points vanish. */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ­​-‍﻿]/g, "")
    .toLowerCase();
}

export interface ParsedSearch {
  /** Terms after removing short ones and stopwords; "-term" excludes. */
  terms: string[];
  /** Number of raw terms (search_terms_count), decides the ordering. */
  count: number;
}

/** parse_search() + parse_search_terms() */
export function parseSearch(s: string): ParsedSearch {
  const matches = s.match(/".*?("|$)|((?<=[\t ",+])|^)[^\t ",+]+/g);
  if (!matches) return { terms: [s], count: 1 };
  const terms: string[] = [];
  for (const raw of matches) {
    // Exact phrases keep their spaces; other terms lose surrounding quotes and spaces.
    const term = /^".+"$/.test(raw)
      ? raw.replace(/^["']+|["']+$/g, "")
      : raw.replace(/^["' ]+|["' ]+$/g, "");
    if (!term || (term.length === 1 && /^[a-z-]$/i.test(term))) continue;
    if (SEARCH_STOPWORDS.has(term.toLowerCase())) continue;
    terms.push(term);
  }
  // Only short terms or stopwords, or ten and more: the whole string as one sentence.
  return {
    terms: terms.length === 0 || terms.length > 9 ? [s] : terms,
    count: matches.length,
  };
}

interface FoldedDocument {
  doc: SearchDocument;
  title: string;
  excerpt: string;
  content: string;
}

/** Folds the documents once; the result is reused for every search. */
export function prepareSearch(docs: SearchDocument[]): FoldedDocument[] {
  return docs.map((doc) => ({
    doc,
    title: foldForSearch(doc.title),
    excerpt: foldForSearch(doc.excerpt),
    content: foldForSearch(doc.content),
  }));
}

/**
 * The ids of the posts WordPress finds for `s`, in its order. An empty `s`
 * is no search: every post, newest first.
 */
export function searchPosts(prepared: FoldedDocument[], s: string): number[] {
  const byDate = (a: FoldedDocument, b: FoldedDocument) =>
    b.doc.date.localeCompare(a.doc.date) || b.doc.id - a.doc.id;
  if (s.length === 0) return [...prepared].sort(byDate).map((entry) => entry.doc.id);

  const { terms, count } = parseSearch(s);
  const like = (field: string, term: string) => field.includes(foldForSearch(term));
  const anyField = (entry: FoldedDocument, term: string) =>
    like(entry.title, term) || like(entry.excerpt, term) || like(entry.content, term);
  const hits = prepared.filter((entry) =>
    terms.every((term) =>
      term.startsWith("-") ? !anyField(entry, term.slice(1)) : anyField(entry, term),
    ),
  );

  const positive = terms.filter((term) => !term.startsWith("-"));
  // Searches with a negative term are not ordered by the whole sentence.
  const sentence = /(?:\s|^)-/.test(s) ? "" : s;
  const rank = (entry: FoldedDocument): number => {
    if (count <= 1) return positive.length > 0 && like(entry.title, positive[0]) ? 0 : 1;
    if (sentence && like(entry.title, sentence)) return 1;
    if (positive.length > 0 && positive.length < 7) {
      if (positive.every((term) => like(entry.title, term))) return 2;
      if (positive.length > 1 && positive.some((term) => like(entry.title, term))) return 3;
    }
    if (sentence && like(entry.excerpt, sentence)) return 4;
    if (sentence && like(entry.content, sentence)) return 5;
    return 6;
  };
  return hits
    .map((entry) => ({ entry, rank: rank(entry) }))
    .sort((a, b) => a.rank - b.rank || byDate(a.entry, b.entry))
    .map(({ entry }) => entry.doc.id);
}

/**
 * Query string of the page links of a search: get_pagenum_link() rebuilds it
 * with PHP's urlencode() ("+" for spaces), and an empty value loses its "=".
 */
export function searchQuery(s: string): string {
  if (s === "") return "?s";
  const encoded = encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `?s=${encoded}`;
}
