import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveBlogShortlink } from "./shortlink";

const permalinks = { "952": "/blog/2026/06/spendenkonto-zieht-um/" };
const resolve = (href: string, basePath = "") => resolveBlogShortlink(href, permalinks, basePath);

test("both WordPress forms of a short link lead to the permalink", () => {
  assert.equal(
    resolve("https://x.de/blog/?p=952"),
    "https://x.de/blog/2026/06/spendenkonto-zieht-um/",
  );
  assert.equal(
    resolve("https://x.de/blog/?post_type=post&p=952"),
    "https://x.de/blog/2026/06/spendenkonto-zieht-um/",
  );
});

test("basePath, other parameters and the hash stay", () => {
  assert.equal(
    resolve("https://x.de/sub/blog/?p=952&utm_source=app#more-952", "/sub"),
    "https://x.de/sub/blog/2026/06/spendenkonto-zieht-um/?utm_source=app#more-952",
  );
});

test("unknown ids and other post types end on the 404 page, like WordPress", () => {
  assert.equal(resolve("https://x.de/blog/?p=99999"), "https://x.de/404/");
  assert.equal(resolve("https://x.de/blog/?post_type=page&p=952"), "https://x.de/404/");
});

test("without a numeric id nothing happens", () => {
  assert.equal(resolve("https://x.de/blog/"), null);
  assert.equal(resolve("https://x.de/blog/?s=wahl"), null);
  assert.equal(resolve("https://x.de/blog/?p=abc"), null);
  assert.equal(resolve("https://x.de/blog/?p=0"), null);
});

test("the function survives serialisation into the inline script", () => {
  const revived = new Function(
    `return (${resolveBlogShortlink.toString()})`,
  )() as typeof resolveBlogShortlink;
  assert.equal(
    revived("https://x.de/blog/?p=952", permalinks, ""),
    "https://x.de/blog/2026/06/spendenkonto-zieht-um/",
  );
});
