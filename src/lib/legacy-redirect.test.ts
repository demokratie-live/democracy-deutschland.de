import assert from "node:assert/strict";
import { test } from "node:test";
import { legacyPathRules, toLegacyPathEntries } from "./legacy-paths";
import { resolveLegacyUrl, type LegacyRouteMap } from "./legacy-redirect";

const APK = "https://github.com/x/releases/latest/download/democracy-app.apk";
const AAB = "https://github.com/x/releases/latest/download/democracy-app.aab";

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
  paths: toLegacyPathEntries(legacyPathRules({ apk: APK, aab: AAB })),
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

test("state variables of old newsletter mails become query parameters", () => {
  assert.equal(
    resolve("https://x.de/#!unsubscribe;token.0a1b2c"),
    "https://x.de/unsubscribe/?token=0a1b2c",
  );
  assert.equal(
    resolve("https://x.de/?_escaped_fragment_=unsubscribe;token.a.b&x=1"),
    "https://x.de/unsubscribe/?token=a.b&x=1",
  );
  assert.equal(resolve("https://x.de/#!about;flag"), "https://x.de/ueber-uns/?flag=");
  assert.equal(resolve("https://x.de/#!about(sub)"), "https://x.de/ueber-uns/");
});

test("encoded hash of old app links", () => {
  assert.equal(resolve("https://x.de/%23!about"), "https://x.de/ueber-uns/");
  assert.equal(resolve("https://x.de/%23!engineering#help"), "https://x.de/engineering/");
});

test("old paths of legacy-paths.ts", () => {
  assert.equal(resolve("https://x.de/index.php"), "https://x.de/");
  assert.equal(resolve("https://x.de/index.php?page=about"), "https://x.de/ueber-uns/");
  assert.equal(resolve("https://x.de/invite"), "https://x.de/");
  assert.equal(resolve("https://x.de/invite/"), "https://x.de/");
  assert.equal(resolve("https://x.de/invite/C1B381E2"), "https://x.de/");
  assert.equal(resolve("https://x.de/invite/AB296297/"), "https://x.de/");
  assert.equal(resolve("https://x.de/invite.php?code=C1B381E2"), "https://x.de/");
  assert.equal(resolve("https://x.de/invite/a/b"), null);
  assert.equal(resolve("https://x.de/Wahlometer"), "https://x.de/wahlometer/");
  assert.equal(resolve("https://x.de/wahl-o-meter/?x=1"), "https://x.de/wahlometer/?x=1");
  assert.equal(resolve("https://x.de/files/download/democracy-app.apk"), APK);
  assert.equal(resolve("https://x.de/files/download/democracy-app.aab"), AAB);
  assert.equal(resolve("https://x.de/blog/index.php?p=5"), "https://x.de/blog/?p=5");
  assert.equal(resolve("https://x.de/blog/page/1/"), "https://x.de/blog/");
  assert.equal(
    resolve("https://x.de/blog/category/newsletter/page/1/"),
    "https://x.de/blog/category/newsletter/",
  );
  assert.equal(resolve("https://x.de/blog/feed/atom/"), "https://x.de/blog/feed/");
  assert.equal(resolve("https://x.de/blog/tag/wahl/feed/rdf/"), "https://x.de/blog/tag/wahl/feed/");
  assert.equal(resolve("https://x.de/blog/page/12/"), null);
  assert.equal(resolve("https://x.de/files/download/Satzung_DEMOCRACY.pdf"), null);
});

test("aliases forward", () => {
  assert.equal(resolve("https://x.de/democracy/"), "https://x.de/");
  assert.equal(resolve("https://x.de/democracy"), "https://x.de/");
});

test("normal URLs stay untouched", () => {
  assert.equal(resolve("https://x.de/"), null);
  assert.equal(resolve("https://x.de/wahlometer/#wom-campaign-container"), null);
  assert.equal(resolve("https://x.de/ueber-uns/?foo=1"), null);
  assert.equal(resolve("https://x.de/wahlometer/?x=1"), null);
  assert.equal(resolve("https://x.de/unsubscribe/?token=abc"), null);
});

test("basePath is respected", () => {
  const base = "/democracy-deutschland.de";
  assert.equal(resolve(`https://x.de${base}/#!about`, base), `https://x.de${base}/ueber-uns/`);
  assert.equal(resolve(`https://x.de${base}/democracy/`, base), `https://x.de${base}/`);
  assert.equal(resolve(`https://x.de${base}/`, base), null);
  assert.equal(resolve(`https://x.de${base}/invite/C1B381E2`, base), `https://x.de${base}/`);
  assert.equal(resolve(`https://x.de${base}/files/download/democracy-app.apk`, base), APK);
  assert.equal(resolve(`https://x.de${base}/%23!about`, base), `https://x.de${base}/ueber-uns/`);
  assert.equal(resolve(`https://x.de${base}/blog/page/1/`, base), `https://x.de${base}/blog/`);
});

test("the function survives serialisation into an inline script", () => {
  // LegacyRedirectScript inlines resolveLegacyUrl.toString(); it must not
  // depend on module scope.
  const fn = new Function(`return (${resolveLegacyUrl.toString()})`)() as typeof resolveLegacyUrl;
  assert.equal(fn("https://x.de/#!engineering#help", map, ""), "https://x.de/engineering/#help");
  assert.equal(
    fn("https://x.de/#!unsubscribe;token.ab", map, ""),
    "https://x.de/unsubscribe/?token=ab",
  );
  assert.equal(fn("https://x.de/blog/feed/atom/", map, ""), "https://x.de/blog/feed/");
  assert.equal(fn("https://x.de/files/download/democracy-app.apk", map, ""), APK);
});
