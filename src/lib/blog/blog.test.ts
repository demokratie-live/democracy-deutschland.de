import assert from "node:assert/strict";
import { test } from "node:test";
import { fromHtml } from "hast-util-from-html";
import { htmlToMarkdown } from "../../../scripts/blog/html-to-markdown";
import { closeRunawayImgTags } from "../../../scripts/blog/live-fixes";
import { normalizeNodes } from "../../../scripts/blog/normalize";
import type { BlogMediaItem } from "../schemas/blog";
import { formatMonth, formatPostDate } from "./format";
import { attachmentImage, ImageLoading, wpCalculateImageSrcset } from "./images";
import { markdownToHast, renderPostContent } from "./markdown";
import { wptexturize } from "./texturize";

const SPENDENKONTO: BlogMediaItem = {
  id: 967,
  file: "/blog/wp-content/uploads/2026/06/Spendenkonto2.jpg",
  width: 1600,
  height: 888,
  sizes: [
    { name: "medium", file: "Spendenkonto2-300x167.jpg", width: 300, height: 167 },
    { name: "large", file: "Spendenkonto2-1024x568.jpg", width: 1024, height: 568 },
    { name: "thumbnail", file: "Spendenkonto2-150x150.jpg", width: 150, height: 150 },
    { name: "medium_large", file: "Spendenkonto2-768x426.jpg", width: 768, height: 426 },
    { name: "1536x1536", file: "Spendenkonto2-1536x852.jpg", width: 1536, height: 852 },
    { name: "post-thumbnail", file: "Spendenkonto2-88x88.jpg", width: 88, height: 88 },
    { name: "post-image", file: "Spendenkonto2-900x500.jpg", width: 900, height: 500 },
    { name: "post-image-cover", file: "Spendenkonto2-1280x710.jpg", width: 1280, height: 710 },
  ],
};

test("wptexturize: the title rules of the imported posts", () => {
  assert.equal(wptexturize("News #38 – Weihnachtsbrief '25"), "News #38 – Weihnachtsbrief ’25");
  assert.equal(wptexturize("News #27 – DEMOCRACY'21"), "News #27 – DEMOCRACY’21");
  assert.equal(wptexturize("News 26 - Verlosung und Team"), "News 26 – Verlosung und Team");
  assert.equal(
    wptexturize("Bündnis 90/Die Grünen-Wahlprogramm"),
    "Bündnis 90/Die Grünen-Wahlprogramm",
  );
});

test("dates like get_the_date('j. F Y') of WordPress (de_DE)", () => {
  assert.equal(formatPostDate("2026-06-14T10:20:02"), "14. Juni 2026");
  assert.equal(formatPostDate("2017-12-03T12:21:14"), "3. Dezember 2017");
  assert.equal(formatMonth("2022-03"), "März 2022");
});

test("srcset of a featured image equals live (index and single post)", () => {
  // Live markup of /blog/ and /blog/2026/06/spendenkonto-zieht-um/ (2026-10-13).
  const dir = "/blog/wp-content/uploads/2026/06/Spendenkonto2";
  const index = attachmentImage(SPENDENKONTO, "post-image");
  assert.equal(index.src, `${dir}-900x500.jpg`);
  assert.equal(
    index.srcSet,
    `${dir}-900x500.jpg 900w, ${dir}-300x167.jpg 300w, ${dir}-1024x568.jpg 1024w, ${dir}-768x426.jpg 768w, ${dir}-1536x852.jpg 1536w, ${dir}-1280x710.jpg 1280w, ${dir}.jpg 1600w`,
  );
  assert.equal(index.sizes, "(max-width: 900px) 100vw, 900px");
  const cover = attachmentImage(SPENDENKONTO, "post-image-cover");
  assert.equal(
    cover.srcSet,
    `${dir}-1280x710.jpg 1280w, ${dir}-300x167.jpg 300w, ${dir}-1024x568.jpg 1024w, ${dir}-768x426.jpg 768w, ${dir}-1536x852.jpg 1536w, ${dir}-900x500.jpg 900w, ${dir}.jpg 1600w`,
  );
});

test("an original narrower than the theme size is used itself (image_downsize)", () => {
  const item: BlogMediaItem = {
    id: 863,
    file: "/blog/wp-content/uploads/2024/12/Kommentar_02_Blog.png",
    width: 1263,
    height: 650,
    sizes: [{ name: "medium", file: "Kommentar_02_Blog-300x154.png", width: 300, height: 154 }],
  };
  const cover = attachmentImage(item, "post-image-cover");
  assert.equal(cover.src, item.file);
  assert.deepEqual([cover.width, cover.height], [1263, 650]);
  assert.equal(
    cover.srcSet,
    "/blog/wp-content/uploads/2024/12/Kommentar_02_Blog.png 1263w, /blog/wp-content/uploads/2024/12/Kommentar_02_Blog-300x154.png 300w",
  );
  assert.equal(wpCalculateImageSrcset([150, 150], "/x.png", item), null);
});

test("loading attributes: first large image high priority, three eager, then lazy", () => {
  const loading = new ImageLoading();
  assert.deepEqual(loading.next(1280, 710), { fetchPriority: "high" });
  assert.deepEqual(loading.next(undefined, undefined), {});
  assert.deepEqual(loading.next(1024, 576), {});
  assert.deepEqual(loading.next(1024, 576), {});
  assert.deepEqual(loading.next(1024, 576), { loading: "lazy" });
});

test("render: block classes, more tag, teaser link and lazy sizes", () => {
  const markdown = [
    "Hallo **Welt**",
    "",
    "<!--more-->",
    "",
    "## Weiter",
    "",
    '<figure class="wp-block-image"><img src="/blog/wp-content/uploads/a.png" width="10" height="10" sizes="(max-width: 10px) 100vw, 10px" alt=""></figure>',
    "",
  ].join("\n");
  const options = { wpId: 7, permalink: "/blog/2020/01/x/" };
  const single = renderPostContent(markdown, {
    ...options,
    mode: "single",
    loading: new ImageLoading(),
  });
  assert.match(single.html, /<p class="wp-block-paragraph">Hallo <strong>Welt<\/strong><\/p>/);
  assert.match(single.html, /<span id="more-7"><\/span>/);
  assert.match(single.html, /<h2 class="wp-block-heading">Weiter<\/h2>/);
  assert.ok(single.classes.has("wp-block-image"));
  const teaser = renderPostContent(markdown, {
    ...options,
    mode: "teaser",
    loading: new ImageLoading(),
  });
  assert.doesNotMatch(teaser.html, /Weiter</);
  assert.match(
    teaser.html,
    /<p class="more-link-wrapper"><a class="more-link faux-button" href="\/blog\/2020\/01\/x\/">Weiterlesen<\/a><\/p>$/,
  );
  const loading = new ImageLoading();
  for (let i = 0; i < 3; i++) loading.next(100, 1000);
  const lazy = renderPostContent(markdown, { ...options, mode: "single", loading });
  assert.match(lazy.html, /loading="lazy"/);
  assert.match(lazy.html, /sizes="auto, \(max-width: 10px\) 100vw, 10px"/);
});

test("HTML → Markdown keeps the DOM: Markdown where possible, HTML elsewhere", () => {
  const html = [
    '<p class="wp-block-paragraph">Ein <strong>fetter</strong> und <a href="https://x.de/">Link</a> mit <b>b</b> * und [x]<br>neue Zeile </p>',
    '<p class="has-text-align-center wp-block-paragraph">zentriert</p>',
    '<h2 class="wp-block-heading">Titel</h2>',
    '<ul class="wp-block-list">\n<li>eins</li>\n\n\n\n<li>zwei <em>kursiv</em></li>\n</ul>',
    '<p class="wp-block-paragraph"><strong>Bank: </strong>Sparkasse</p>',
    "<!--more-->",
    '<div class="footer">\n<p>A</p>\n\n\n<p>B</p>\n</div>',
  ].join("\n\n");
  const fragment = fromHtml(html, { fragment: true });
  const markdown = htmlToMarkdown(fragment);
  assert.match(
    markdown,
    /^Ein \*\*fetter\*\* und \[Link\]\(https:\/\/x\.de\/\) mit <b>b<\/b> \\\* und \\\[x]\\\nneue Zeile$/m,
  );
  assert.match(markdown, /^## Titel$/m);
  assert.match(markdown, /^- eins\n- zwei \*kursiv\*$/m);
  assert.match(markdown, /^<p class="has-text-align-center wp-block-paragraph">zentriert<\/p>$/m);
  assert.match(markdown, /<strong>Bank: <\/strong>Sparkasse/);
  assert.match(markdown, /^<!--more-->$/m);
  assert.doesNotMatch(markdown, /\n\s*\n<p>B/);
  assert.equal(
    normalizeNodes(markdownToHast(markdown).children),
    normalizeNodes(fragment.children),
  );
});

test("a runaway logo tag is only closed where it swallows a </div> or the more span", () => {
  const footer = '<p><img id="<x>&#8220; alt=&#8220;L&#8220;><br><a href="mailto:a@b.de">a</a></p>';
  assert.equal(closeRunawayImgTags(footer), footer);
  const runaway =
    '<figure><img id="<x>&#8220; alt=&#8220;L&#8220;></figure>\n</div>\n<span id="more-1"></span>';
  assert.equal(
    closeRunawayImgTags(runaway),
    '<figure><img id="<x>&#8220; alt=&#8220;L&#8220;"></figure>\n</div>\n<span id="more-1"></span>',
  );
});
