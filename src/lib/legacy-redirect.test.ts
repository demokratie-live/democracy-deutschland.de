import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLegacyUrl, type LegacyRouteMap } from "./legacy-redirect";

const map: LegacyRouteMap = {
  start: "/",
  states: {
    home: "/",
    wahlometer: "/wahlometer/",
    about: "/ueber-uns/",
    engineering: "/engineering/",
    unsubscribe: "/unsubscribe/",
  },
  aliases: { "/democracy/": "/" },
};

const resolve = (href: string, basePath = "") => resolveLegacyUrl(href, map, basePath);

test("hash states map to clean paths", () => {
  assert.equal(resolve("https://x.de/#!about"), "https://x.de/ueber-uns/");
  assert.equal(resolve("https://x.de/#!wahlometer"), "https://x.de/wahlometer/");
  assert.equal(resolve("https://x.de/#!home"), "https://x.de/");
});

test("anchor after the state is kept", () => {
  assert.equal(resolve("https://x.de/#!engineering#help"), "https://x.de/engineering/#help");
  assert.equal(
    resolve("https://x.de/#!wahlometer#wom-campaign-container"),
    "https://x.de/wahlometer/#wom-campaign-container",
  );
});

test("unknown and empty states land on the start page like live", () => {
  assert.equal(resolve("https://x.de/#!does-not-exist"), "https://x.de/");
  assert.equal(resolve("https://x.de/#!"), "https://x.de/");
});

test("?page= and ?_escaped_fragment_= keep the other parameters", () => {
  assert.equal(
    resolve("https://x.de/?page=unsubscribe&token=abc"),
    "https://x.de/unsubscribe/?token=abc",
  );
  assert.equal(resolve("https://x.de/?_escaped_fragment_=about"), "https://x.de/ueber-uns/");
});

test("aliases forward", () => {
  assert.equal(resolve("https://x.de/democracy/"), "https://x.de/");
  assert.equal(resolve("https://x.de/democracy"), "https://x.de/");
});

test("normal URLs stay untouched", () => {
  assert.equal(resolve("https://x.de/"), null);
  assert.equal(resolve("https://x.de/wahlometer/#wom-campaign-container"), null);
  assert.equal(resolve("https://x.de/ueber-uns/?foo=1"), null);
});

test("basePath is respected", () => {
  const base = "/democracy-deutschland.de";
  assert.equal(resolve(`https://x.de${base}/#!about`, base), `https://x.de${base}/ueber-uns/`);
  assert.equal(resolve(`https://x.de${base}/democracy/`, base), `https://x.de${base}/`);
  assert.equal(resolve(`https://x.de${base}/`, base), null);
});

test("the function survives serialisation into an inline script", () => {
  // LegacyRedirectScript inlines resolveLegacyUrl.toString(); it must not
  // depend on module scope.
  const fn = new Function(`return (${resolveLegacyUrl.toString()})`)() as typeof resolveLegacyUrl;
  assert.equal(fn("https://x.de/#!engineering#help", map, ""), "https://x.de/engineering/#help");
});
