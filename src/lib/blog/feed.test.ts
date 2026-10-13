import assert from "node:assert/strict";
import { test } from "node:test";
import { feedExcerpt, renderFeed } from "./feed";
import { berlinToUtc, formatRfc2822 } from "./format";

test("post_date_gmt from the local time of the blog (Europe/Berlin)", () => {
  assert.equal(
    formatRfc2822(berlinToUtc("2026-06-14T10:20:02")),
    "Sun, 14 Jun 2026 08:20:02 +0000",
  );
  assert.equal(
    formatRfc2822(berlinToUtc("2025-12-21T18:41:51")),
    "Sun, 21 Dec 2025 17:41:51 +0000",
  );
  // Around the switch to summer time (29 March 2026, 02:00 → 03:00).
  assert.equal(berlinToUtc("2026-03-29T01:30:00").toISOString(), "2026-03-29T00:30:00.000Z");
  assert.equal(berlinToUtc("2026-03-29T03:30:00").toISOString(), "2026-03-29T01:30:00.000Z");
});

test("feed excerpt: 55 words of the whole content, like wp_trim_excerpt() in a feed", () => {
  const words = Array.from({ length: 60 }, (_, index) => `w${index + 1}`);
  const markdown = `${words.slice(0, 30).join(" ")}\n\n<!--more-->\n\n${words.slice(30).join(" ")}\n`;
  assert.equal(feedExcerpt(markdown), `${words.slice(0, 55).join(" ")} […]`);
  assert.equal(feedExcerpt("Kurzer Text.\n"), "Kurzer Text.");
});

test("feed excerpt: a <br> joins words, two of them separate them, image blocks drop out", () => {
  assert.equal(feedExcerpt("Gruß,\\\nIhr Marius\n"), "Gruß,Ihr Marius");
  assert.equal(feedExcerpt("<p>Ende.<br><br>Neu</p>\n"), "Ende. Neu");
  assert.equal(
    feedExcerpt(
      'Vorher\n\n<figure class="wp-block-image"><img src="/a.png" alt=""><figcaption>Bildtext</figcaption></figure>\n\nNachher\n',
    ),
    "Vorher Nachher",
  );
});

test("the blog feed lists the newest posts with the stored guid", async () => {
  const xml = await renderFeed("");
  assert.ok(xml);
  assert.equal(xml.match(/<item>/g)?.length, 10);
  assert.match(xml, /<atom:link href="https:\/\/democracy-deutschland\.de\/blog\/feed\/"/);
  assert.equal(await renderFeed("category/gibt-es-nicht"), null);
  const newsletter = await renderFeed("tag/newsletter");
  assert.match(
    newsletter ?? "",
    /<guid isPermaLink="false">https:\/\/www\.democracy-deutschland\.de\/blog\/\?p=\d+<\/guid>/,
  );
});
