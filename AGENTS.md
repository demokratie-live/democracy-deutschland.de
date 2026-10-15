# DEMOCRACY Deutschland – Website (static 1:1 port)

This repo is a **1:1 port** of the PHP website [democracy-deutschland.de](https://democracy-deutschland.de/) (repo `demokratie-live/democracy-website`) to Next.js with static export. Every module must look and behave exactly like live. Only clear bugs are fixed, and each fix or deviation is recorded in [`docs/abweichungen.md`](docs/abweichungen.md). Whatever needs a server is not built but listed in [`docs/server-funktionen.md`](docs/server-funktionen.md).

**The live site is the truth** for content and behaviour, not the SQL dumps of the PHP repo and not older content in this repo:

- client-side page: `https://democracy-deutschland.de/#!<state>` (start page `/` = state `home`)
- server-rendered HTML: `https://democracy-deutschland.de/?_escaped_fragment_=<state>`
- source: `democracy/page/default_<module>/{tpl,js,css}` and frame `default_page/` in democracy-website

Access live read-only. Never call `setup.php`.

**Stack:** Next.js 16 (App Router, `output: "export"`, `trailingSlash`), React 19, TypeScript strict, original Bootstrap 4.0.0 CSS, MDX + YAML with Zod v4, pnpm. Scripts: see `package.json`. The redesign that lived here before (Tailwind) is in commit `bf85f9c` (`git show bf85f9c:<path>`).

## Architecture

```
content/
  pages/<id>.mdx        page text and section layout, frontmatter `state` (+ optional head overrides)
  site/head.yaml        title, meta, Open Graph, icons, manifest, external CSS
  site/routes.yaml      every old state → new path, navbar `menu`/`startpage`, aliases
  site/navigation.yaml  navbar   site/footer.yaml  footer   site/app-links.yaml  store/APK links
  site/forms.yaml       recipient, mail subject and alert texts of the forms (contact, bug report, volunteer)
  legal/<name>.md       Impressum, Datenschutz, Nutzungsbedingungen: plain Markdown with inline HTML (see "Legal texts")
  donate/donation.yaml  donation status: /spenden/ and the app JSON (see README)
  team/team.yaml        team cards of /ueber-uns/ (see README)
  press/media.yaml      media tiles of /presse/ (see README)
  faq/faq.yaml          category menu and questions of /faq/ (see README)
  engineering/roadmap.yaml  roadmap table of /engineering/ with the status codes of icon_class() (see README)
  blog/<slug>.md        blog posts (WordPress), written by `pnpm import-blog` (see "Blog")
  blog/taxonomy.yaml, media.yaml, missing-uploads.yaml  written by the import; blog/site.yaml  blog settings
public/
  css/                  original CSS (see "CSS"); files/  assets under the old /files/ paths
  blog/wp-content/uploads/  blog media under their WordPress paths (written by the import)
  blog/wp-content/themes/lovecraft/  theme CSS, fonts and icon of the blog (GPL, never edit)
  videos/  favicon.ico  manifest.json  root files of the PHP site (apple-touch-icon.png, android-chrome-*,
  favicon-16x16/32x32.png, browserconfig.xml, site.webmanifest, logo.png), byte for byte
src/
  app/(site)/           website: root layout (SiteDocument) and thin page shells <MdxPage id="…" />;
                        [...alias] forwarding pages; api.php/, api/donation_status.json/: static GET
                        route handlers (app JSON); .htaccess/: out/.htaccess for Apache (Plesk)
  app/(blog)/blog/[[...path]]/  blog: one catch-all route with its own root layout (see "Blog");
                        feed/index.html/, {category,author,tag}/[slug]/feed/index.html/: RSS route
                        handlers; search-index.json/: data of the client search
  app/(site)/blogseite/ the blog in the website frame (iframe, `BlogFrame`)
  app/global-not-found.tsx  404 page (out/404.html) in the website frame, for every unknown path
  components/frame/     SiteDocument (website root document), Navbar, Footer, ToTop (UItoTop),
                        LegacyRedirectScript, NotFound
  components/blog/      Lovecraft templates: BlogDocument, BlogHeader (toggles), Sidebar, PostEntry,
                        BlogIndex (lists), BlogSearch (client search), BlogQueryScript (?s=, ?p=), …
  components/blogpage/  BlogFrame (iframe of /blogseite/)
  components/shared/    sections used by several modules (AppHeader, Section, Link, VideoSection, …)
  components/<module>/  sections of one module (home/, wahlometer/, donate/, about/, contact/, legal/, engineering/, …)
  components/mdx/       MdxPage (render + head), MDXComponents (registry)
  lib/                  animate.ts (jQuery animations), legacy-redirect.ts, legacy-paths.ts, metadata.ts,
                        routes.ts, stylesheets.ts, base-path.ts, content/ (loaders), schemas/,
                        bootstrap-modal.ts (Bootstrap 4 modal), bootstrap-collapse.ts (Bootstrap 4
                        collapse), bootstrap-tooltip.ts (Bootstrap 4 tooltip, Popper.js 1.12.9),
                        roadmap.ts (icon_class()), donation.ts (PHP round/number_format/json_encode, donation
                        JSON), donation-route.ts, htaccess.ts (+ htaccess-route.ts), content/blog.ts (blog posts, permalinks),
                        forms.ts (validateEmail, form checks, endpoint or mailto),
                        blog/ (view, listing, Markdown pipeline, srcset/loading, wptexturize, head
                        styles, feed, search, search-index, shortlink)
scripts/                validate-content.ts, compare.ts, serve-basepath.mjs, import-blog.ts,
                        compare-blog-dom.ts, compare-blog-feed.ts, compare-blog-search.ts,
                        blog/ (HTML → Markdown, DOM normalization, live fixes),
                        serve-apache.sh + check-htaccess.ts (out/.htaccess on Apache), publish-build-branch.sh
tests/e2e/, tests/basepath/, tests/fixtures/ (saved live responses, byte for byte: app JSON, legal texts),
tests/legacy-urls.ts (every kind of old URL and its target, for Playwright and check-htaccess)
```

## Content maintenance, preview and deploy

The step-by-step guides for editors are in the README; keep both in sync.

- **Content:** page text in `content/pages/<id>.mdx`, frame data in `content/site/*.yaml`; lists with their own file and README section: donation status (`donate/donation.yaml`, also the app JSON), team, press, FAQ, legal texts, roadmap, blog (`pnpm import-blog` while WordPress runs, Markdown afterwards). Always `pnpm validate-content`.
- **Preview:** `pnpm dev`; the export with `pnpm build && pnpm start`, with `.htaccess` via `pnpm serve-apache` + `pnpm check-htaccess`; against live with `pnpm compare`. CI uploads `website-root-<run>` (main) and `website-preview-<run>` (basePath).
- **Deploy:** Plesk, not GitHub Pages (decision Manuel 2026-10-13, hosting outside the US). `.github/workflows/deploy.yml` checks every PR and push (lint, content, unit, build, e2e, basePath build + e2e); on push to `main` the job `build-branch` commits the export without basePath to the branch `deploy`, which Plesk-Git deploys. Details, rollback and the switch from the PHP site: `docs/hosting-plesk.md`. Never add a Pages deployment back.

## Porting a module

1. **Read the original**: tpl, the module's `init_<state>()` JS and CSS, then the live DOM _after_ init (DevTools on `#!<state>`). jQuery init leaves inline styles and moved markup behind; the port renders that final state, not the raw template.
2. **Assets**: copy what the page uses from `democracy/files/<cat>/` to `public/files/<cat>/` under the same name. Reference them as `/files/<cat>/<name>` through `asset()` (raw tags) or `Link` (anchors).
3. **Components**: one section component per template block in `src/components/<module>/` (or `shared/` when two modules use it), registered in `src/components/mdx/MDXComponents.tsx`. Original classes and ids stay, duplicates included. Text goes into `content/pages/<id>.mdx` as props or Markdown children.
4. **Page**: `src/app/<path>/page.tsx` as a thin shell (copy `src/app/wahlometer/page.tsx`). The state and path already exist in `routes.yaml`; head overrides go into the frontmatter.
5. **Interactions** in React, no jQuery. Use `src/lib/animate.ts` (`animateScrollTo`, `tween`, easings `swing`/`easeOutQuart`, `SLOW` = 600 ms) to match jQuery timing. Bootstrap 4.0.0 plugins are ported to plain DOM code with the original timings: Collapse in `Navbar` and as `useCollapseTransition()`/`prepareHide()` in `src/lib/bootstrap-collapse.ts` (state in React, see `FaqList`), Modal in `src/lib/bootstrap-modal.ts` (markup server-rendered with `Modal`, opened by `ModalToggle` like the data API), Tooltip in `src/lib/bootstrap-tooltip.ts` (element server-rendered in the state after `_fixTitle()`, i.e. `title=""` and `data-original-title`; the tip is appended to `<body>` and placed by the same Popper.js 1.12.9 as live, see `Hotspot`; `dispose()` on unmount). Inline `<script>`s of a template become a client component that renders `null` and runs the script in an effect (`UpdateProgress`).
6. **Verify**, all until green or explained:
   - `pnpm compare <path>` against a running local server (`pnpm dev` or `pnpm build && pnpm start`, default `--local http://localhost:3000`); use `--click <selector>` for every interaction state, `--hover <selector>` for hover states (viewport only, a full-page screenshot loses the hover), `--only mobile` for mobile-only states and `--live-eval <js>` to reproduce an intended deviation on live before comparing (e.g. remove the FAQ entry the port drops), so the rest still compares pixel by pixel. The tool aborts the old API's writing calls on live (`send_mail`, `upload`, `beta`, `send_subscribe`); stub `sendMail`/`$.ajax` with `--live-eval` before clicking a form button anyway. Pixels, visible text, `#content` text against `?_escaped_fragment_` and head data must match; explain every remainder in `docs/abweichungen.md`.
   - Playwright tests for every interaction (`tests/e2e/<module>.spec.ts`, mobile-only ones in `*.mobile.spec.ts`).
   - `pnpm lint`, `pnpm validate-content`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:basepath`, `pnpm format:check`.
7. **Document**: deviations and fixed bugs in `docs/abweichungen.md`, server needs in `docs/server-funktionen.md`, new components below.

## Rules for 1:1 markup

- **CSS**: `public/css/` holds the files `default_page::css()` loads, byte-identical except `url()` paths made relative to `public/css/` (basePath). All module CSS is loaded on every page in the original order (`src/lib/stylesheets.ts`), because live does the same and rules leak between modules. Never edit these files; no Tailwind, CSS modules or new global CSS. Inline `<style>` blocks of a template are rendered inline (see `SECOND_BADGE_CSS`).
- **Inline styles**: copy them as React style objects. React cannot express `!important`; drop it when no `!important` rule in `public/css` competes (check with grep).
- **Whitespace** between inline or inline-block elements renders on live (template newlines); JSX drops it. Add `{" "}` where the original has whitespace between such elements (e.g. `VersionDigits`, `SymbolInfoPanel`). `pnpm compare` shows the result.
- **Links**: internal `href`s are the new paths with trailing slash (`/ueber-uns/`, `/engineering/#help`), never `#!state`. Use `Link` from `components/shared/Link` (basePath, same-page anchors animated like the old router, no prefetching). Raw `src`/`href` to files under `public/` go through `asset()`.
- **Images**: plain `<img>` like the original, `alt=""` where the original has none.
- **Head**: defaults from `head.yaml` via `buildMetadata()`; `og:*` tags are rendered by `MdxPage`, because Next's `openGraph` metadata adds `twitter:*` tags that live does not have.
- **Navbar state** comes from `routes.yaml` (`menu`, `startpage`), mirroring each `init_<state>()`.
- **Hover** handlers of jQuery (`.hover(in, out)`) become `onMouseEnter`/`onMouseLeave` with state; `show()`/`hide()` leave `display: block`/`display: none` inline, render the same. Taps on touch devices fire the same events.
- **Data from the old SAI/database** (donation status, press media, FAQ, roadmap) goes into YAML with a Zod schema; `validate-content` checks that referenced files exist (`checkFiles`); values that PHP computed (rounding, `number_format`) are computed with the PHP-compatible helpers in `src/lib/donation.ts`, not with `Math.round`/`toLocaleString`.

## Forms (`send_mail`)

The old forms (contact; bug report and volunteer on `/engineering/`, `BugReportForm`/`VolunteerForm`) validate in their click handler and send with `sendMail()` to `api.php?call=send_mail`. The port keeps the checks and alert texts 1:1 and replaces the sending (spec, decisions Manuel 2026-10-13):

- **Checks**: `runChecks()` from `src/lib/forms.ts` with one `{ id, valid, message }` per `if` of the handler, in the same order: the first failing check shows `alert(message)`, then focuses the field. `validateEmail()` is the unchanged function of `default_invite.js` (live never loaded it on the main page, docs/abweichungen.md).
- **Texts**: alert messages, recipient and the mail subject template come from `content/site/forms.yaml` (`getForms()` in a server component, passed to the client form like `ContactForm` → `ContactFormFields`); placeholders and the button label are MDX props.
- **Sending**: `sendForm()` POSTs the old `data` object as JSON to the endpoint when it is set (`"sent"` for HTTP 2xx, else `"failed"`), otherwise it opens a prefilled `mailto:` (`"mailto"`). On `"sent"` reset the form and alert `messages.sent`, on `"failed"` alert `messages.failed`, on `"mailto"` do nothing (no alert, no reset).
- **Endpoint variable**: one per form, `NEXT_PUBLIC_<FORM>_ENDPOINT` (`CONTACT`, `BUGREPORT`, `VOLUNTEER`), referenced literally (`process.env.NEXT_PUBLIC_CONTACT_ENDPOINT`); Next inlines only literal references.
- **Mail labels**: the placeholder without the trailing `*` (`label()`); a checkbox group is one line "<heading>: <checked labels>" or "–".
- **Files (bug report)**: no upload server, so no file picker, drop zone, progress bar or file list (decision Manuel 2026-10-13, a visible deviation). The drop zone's box (`#bug-attachments`) shows a notice from the MDX props `attachMailto` / `attachEndpoint`, picked by `NEXT_PUBLIC_BUGREPORT_ENDPOINT`; `{recipient}` becomes a mailto link to `recipient` of `forms.yaml`, any other placeholder fails the build. The data object has no `files`. The form still cancels `dragover`/`drop` like live, so a dropped file does not replace the page.
- **Tests**: the mailto path in `tests/e2e` (`page.waitForRequest((r) => r.url().startsWith("mailto:"))`, compare decoded, Chromium escapes `'`), the endpoint path in `tests/basepath` (that build sets the endpoint variables, `page.route` answers). Drag & drop: dispatch a `DragEvent("drop")` with a `DataTransfer` built in the page and check `defaultPrevented`. Register `page.on/once("dialog")` before the click that raises an alert; awaiting `waitForEvent("dialog")` after starting the click deadlocks.

## Legal texts

`content/legal/<name>.md` holds the old `system_text` (`impressum_text`, …) as plain Markdown (CommonMark, not MDX). `LegalText` renders it with `MDXRemote` and `mdxOptions: { format: "md", rehypePlugins: [rehypeRaw] }`, so raw HTML (`<br>`, `style="…"`) works without JSX syntax; `a` is mapped to `Link`. The page frame of the template is `content/pages/<name>.mdx`.

- Markdown where the DOM stays the same, HTML only where Markdown cannot express the live layout (decision Manuel 2026-10-13): `<br>` in headings and at the end of blocks, `<ol style="list-style-type: lower-alpha;">`, text directly in the container as `<span>` on its own lines (an HTML block; Markdown would wrap it in `<p>` and add a margin). HTML blocks end at a blank line and contain no Markdown.
- Editor leftovers without effect are dropped (`data-mce-*`, `style="font-weight: 400;"`, attribute-less `<span>`, the `div title="Page 1"` wrapper); words, `&nbsp;`, decomposed umlauts and link targets stay exactly as on live, even the broken ones (`#!datenschutz`, `#!nutzungsbedinungen`). Wording and links change only with the approval of Marius Krüger (follow-up TASK-87 after the go-live). `**x **` does not close in Markdown: move the space outside.
- `tests/e2e/legal.spec.ts` compares the words and link targets of each page (text nodes, `<br>`/blocks as spaces) with `tests/fixtures/<name>.live.html`, loaded via `page.setContent` with all requests aborted. Fixtures are excluded from Prettier (`tests/fixtures/*.live.*`).

## Generated files (app JSON)

`/api.php` and `/api/donation_status.json` are App Router route handlers (`export const dynamic = "force-static"`, `GET` re-exported from `src/lib/donation-route.ts`); `next build` writes them as files into `out/`. The body is byte-identical to the old `api.php?call=donation_status` (PHP 7.4 `round()`, `json_encode()` escaping; only `querytime` is 0). `src/lib/donation.test.ts` checks this against `tests/fixtures/donation_status.live.json` and PHP reference values. Static hosts ignore the query string and serve `.php` as `application/x-httpd-php`; the app parses it anyway (`docs/server-funktionen.md`). Keep these routes static: no request data, no other HTTP methods.

## Blog

The WordPress blog (theme Lovecraft) lives under `/blog/` with its WordPress URLs: `/blog/`, `/blog/page/<n>/`, the permalinks `/blog/<year>/<month>/<slug>/`, the archives `/blog/category/<slug>/`, `/blog/author/<slug>/`, `/blog/tag/<slug>/`, `/blog/<year>/`, `/blog/<year>/<month>/` (each with `page/<n>/`; no day archives, decision Manuel), the feeds `/blog/feed/` and `…/<archive>/feed/`, the search `/blog/?s=` and the short links `/blog/?p=<id>`. It has its own look and frame, not the website frame; `/blogseite/` shows it in an iframe inside the website frame.

### Content (written by the import)

- `content/blog/<slug>.md`: one post per file. Frontmatter per `src/lib/schemas/blog.ts`: `wpId`, `guid` (identity in the feeds, older posts with `www.`), `title` (raw `post_title`), `slug`, `date`/`modified` (local time, quoted), `author`, `categories`, `tags` (slugs; tags in display order by name), `featuredMedia` (`_thumbnail_id`, may point to a deleted attachment), `image` (original upload of the featured image), `excerpt` (plain text of the automatic excerpt up to `<!--more-->`, shown in search results; may end with a no-break space). The body is the post content as **CommonMark with inline HTML**: Markdown wherever it yields exactly the WordPress DOM (paragraphs, headings and lists of the block editor; the render pipeline adds their classes `wp-block-paragraph`, `wp-block-heading`, `wp-block-list`), HTML everywhere else (figures, classes, `<b>`, links with `target` …). `<!--more-->` marks the teaser end like in WordPress. Excluded from Prettier.
- `content/blog/taxonomy.yaml` (authors, categories, tags: id, slug, name), `media.yaml` (featured images with all sizes in metadata order, for srcset), `missing-uploads.yaml` (uploads the posts reference although live already answers 404; `validate-content` accepts them as missing), all written by the import. `content/blog/site.yaml` (title, header image, posts per page and per feed, widget size) is maintained by hand.
- `getBlogPosts()` / `getLatestBlogPosts(limit)` / `blogPermalink()` in `src/lib/content/blog.ts` (newest `date` first); `BlogTeasers` on `/presse/` shows the nine newest with the raw title and the original featured image.
- Media under `public/blog/wp-content/uploads/<year>/<month>/` with their WordPress names, only files the rendered pages reference (srcset sizes included); `data:` images of old newsletters as `uploads/inline/<slug>-<n>.<ext>`.

### Import (`pnpm import-blog`, `scripts/import-blog.ts`)

Read-only, one request at a time, cached in `.cache/blog-import/` (`--refresh` reads again, `--only <slug>` converts one post). Metadata from the REST API (`wp-json/wp/v2`), content from the rendered post page; the script checks that it equals `content.rendered` except for the more span and the loading attributes. It prepares the HTML (more span → `<!--more-->`, loading attributes removed because the page adds them, uploads to local paths, `x-webdoc://…#news_NN` → `#news_NN`, `data:` images → files, attribute names HTML cannot serialize dropped, the runaway logo tag of News #2 closed: `scripts/blog/live-fixes.ts`), converts it block by block (`scripts/blog/html-to-markdown.ts`) and renders every block back through the pipeline: the DOM must equal the original in canonical form (`scripts/blog/normalize.ts`, CSS whitespace rules), else the block stays HTML; the whole post is checked once more. It stops when `wptexturize(title)` differs from the rendered title (extend `src/lib/blog/texturize.ts`), on unknown `<style>` blocks or formats. It also writes the inline `<style>` blocks of the WordPress head to `src/lib/blog/inline-css/` (never edit), downloads missing uploads and deletes unreferenced ones and posts that are gone.

### Rendering

- `src/app/(blog)/blog/[[...path]]/`: one catch-all route; its **layout is the root layout** of the blog (`BlogDocument`), so `<head>` styles, body class and header image depend on the page like in WordPress. `getBlogView(path)` (`src/lib/blog/view.ts`, React `cache`, shared by layout and page) resolves the path to an `IndexView` (blog home and archives, lists from `getListings()`) or a `SingleView`; `blogStaticParams()` lists every page.
- Lists (`BlogIndex`, `src/lib/blog/listing.ts`, no server code, shared with the client search): archive header `Kategorie:`/`Autor:`/`Schlagwort:`/`Monat:`/`Jahr:` + `<span>name</span>`, then `<span>Seite x von y</span>` **only while a next page follows** (Lovecraft); `listingBodyClass()` (body_class() order, duplicates dropped: `tag-7 tag-7`), `listingTitle()`; the sidebar marks the current category (`current-cat`, `aria-current`) and month. The blog title is an `<h1>` only on the blog home (not on archives, search or posts).
- `src/lib/blog/markdown.ts`: `renderPostContent()` = remark-parse → remark-rehype → block classes → rehype-raw → more tag (single: `<span id="more-<id>">`, teaser: cut + "Weiterlesen") → loading attributes → basePath → HTML string for `dangerouslySetInnerHTML` (the exact WordPress markup, no React attribute mapping).
- `src/lib/blog/images.ts`: `wp_calculate_image_srcset()` with `wp_image_matches_ratio()`/`wp_constrain_dimensions()` (PHP `round()` via `phpRound`), `attachmentImage()` (theme sizes `post-image` 900 and `post-image-cover` 1280, the original when it is narrower), `ImageLoading` (`wp_get_loading_optimization_attributes()`: per page, the first large image `fetchpriority="high"`, the first three eager, later ones `loading="lazy"` with `sizes="auto, …"`).
- `src/lib/blog/styles.ts`: inline styles in live order; block styles only for blocks of the page (sidebar blocks always), global styles plus block lines, `core-block-supports` per gallery. Theme CSS via `<link>` with the original `?ver=`.
- Titles: `wptexturize()` on the raw title (`'25` → `’25`, space-hyphen-space → space-en-dash-space); the press teasers show the raw title. Page titles: "DEMOCRACY Blog – Seite\u00a0<n>" (no-break space like WordPress).
- Links are plain `<a>` with `asset()`: full page loads like WordPress, no Next router in the blog. `BlogHeader` ports global.js (slideToggle via `slide()` in `src/lib/animate.ts`, 400 ms swing, reset above 1000 px).

### Feeds, search, short links, `/blogseite/`

- **Feeds** (`src/lib/blog/feed.ts`): feed-rss2.php of WordPress for the blog and every category, author and tag: the newest `postsPerFeed` posts, `lastBuildDate` = newest `modified` (GMT via `berlinToUtc()`), categories then tags by name, `guid` from the frontmatter (older posts keep `www.`), description = `feedExcerpt()` (wp_trim_excerpt of the **whole** content: 55 words, removed blocks such as images, a Markdown line break joins words like the bare `<br>` of WordPress, `<br><br>` separates them), content = single render with loading attributes counted over the feed and absolute URLs (`urlPrefix: ORIGIN`). Routes are folders named `index.html` (`…/feed/index.html/route.ts`): static hosts serve directory indexes only; the dev server answers `/blog/feed/index.html`, not `/blog/feed/`.
- **Search** (`src/lib/blog/search.ts`): `parseSearch()` (terms, German stopwords), `foldForSearch()` (case and accents), `searchPosts()` (all terms, `-term`, ordering of parse_search_order() and date), `searchQuery()` (page links like urlencode(), `?s` for an empty term). `/blog/search-index.json` (`buildSearchIndex()`) holds the content as WordPress searches it (`searchContent()`) and the result entries: results show the **excerpt** (`<p>` of the frontmatter `excerpt`, as `the_excerpt()` in Lovecraft's search template), the block styles of the allowed blocks of the teaser (an excerpt renders them) and the featured image.
- `BlogSearch` (client) wraps the content column of `/blog/` and `/blog/page/<n>/`. `useBlogSearchQuery()` returns null during hydration (the static HTML is the post list), then the term; the component loads the index, renders `BlogIndex` or the no-results article and sets title, body class, `noindex`, block styles in `<head>` and the widget value. `BlogQueryScript` in `<head>` hides the column with a **constructed style sheet** (`document.adoptedStyleSheets`): an extra node in `<head>` would break the hydration of the root layout. A search page beyond the last one goes to `/404/`. `?s=` on other blog pages is ignored.
- **Short links**: `BlogQueryScript` on `/blog/` inlines `resolveBlogShortlink()` (`src/lib/blog/shortlink.ts`, serialised with `toString()` like `resolveLegacyUrl()`, no inner functions) with the map `wpId` → permalink: `?p=<id>` and `?post_type=post&p=<id>` go to the permalink (other parameters and the hash stay), unknown ids to `/404/`.
- **`/blogseite/`** (`content/pages/blog.mdx`, `BlogFrame`): iframe on `/blog/` (basePath), height = body `scrollHeight` of the frame on every load, also when the frame was loaded before hydration.

### Gotchas

- Whitespace between inline blocks renders: the template has it between the paragraphs of `.post-meta` and `.archive-navigation .fright`, between the toggle buttons and between search field and button; JSX needs `{" "}` there. The DOM comparison treats `<p>` as block and does not see it, `pnpm compare` does.
- WordPress term classes use the term ID for numeric slugs (`tag-7` for "2021"); the search widget id counts `wp_unique_id()` over the page (a gallery before it makes it `wp-block-search__input-2`).
- `.toggles` has no height (absolutely positioned buttons): test the buttons for visibility.
- `getBlogView()` is cached per render with a string key; arrays as `cache` arguments compare by identity.
- Render numbers and labels as **one string** (``{`Seite ${page} von ${pages}`}``, ``{`${text} `}``): React splits `Seite {page} von {pages}` into several text nodes, and Chrome shapes text across node boundaries slightly differently (centred archive titles moved by a fraction of a pixel).

### Verification

- `pnpm compare /blog/…` compares with the same path on live; the WordPress emoji script is blocked on live (no emoji script statically, decision Manuel 2026-10-13), lazy images load eagerly, the full page is captured by enlarging the viewport first (live otherwise switches srcset candidates during the screenshot), `text-content.diff` uses `main#site-content` of the server HTML.
- `pnpm compare-blog-dom [--local <url>] [path …]` compares title, body class, head links (canonical, shortlink, feeds), header, navigation, header image, main (posts, sidebar) and credits of every blog page (archives included) and of the search pages in `SEARCH_PATHS` with live in canonical form; search pages render in Chromium. Documented deviations are mapped (search form ids, `alt=""` of the header image, `data:` images, `x-webdoc` links, invalid attribute names, News #2, comment and search feeds).
- `pnpm compare-blog-feed [--local <url>]` compares every feed with live after XML decoding (channel, items, content in canonical form; live emoji images count as their character, `www.` uploads as without).
- `pnpm compare-blog-search [term …]` compares hits (REST `?search=`) and order (first results page) of 25 terms with the live search; hits inside base64 image data of old newsletters are listed, not counted.
- `pnpm compare "/blog/?s=…"` waits for the client results; `pnpm compare /blogseite/ --no-mask` compares the blog inside the frame.
- Pages with the closed logo tag (`/blog/page/6/`, News #2) compare pixel by pixel when `--live-eval` refetches the live HTML, applies the regex of `scripts/blog/live-fixes.ts` and rewrites the document (`document.open()/write()`), then waits for images and fonts.
- `content/blog/*.md` are generated: change posts in WordPress and import again while WordPress runs. After the switch the Markdown is the source; check edits with `pnpm compare`.

## Routing and legacy links

The app has two root layouts in route groups: `src/app/(site)/layout.tsx` (website frame, `SiteDocument`) and the blog (`src/app/(blog)`); a navigation between them loads the full page. Unknown paths get `src/app/global-not-found.tsx` (`experimental.globalNotFound`, the 404 page in the website frame). `routes.yaml` is the single source for paths and states.

Old URLs are forwarded in two ways from the same data:

- **Client** (every host): `LegacyRedirectScript` inlines `resolveLegacyUrl()` into `<head>` of every website page **and of the 404 page**, and forwards before rendering, again on `hashchange`: `#!<state>`, `#!<state>#<anchor>`, state variables `#!<state>;<key>.<value>` (→ query parameters, e.g. `#!unsubscribe;token.<x>` of old newsletter mails → `/unsubscribe/?token=<x>`), `?page=<state>`, `?_escaped_fragment_=<state>`, `/%23!<state>`, `aliases` and the old paths of `src/lib/legacy-paths.ts`. On hosts without `.htaccess` an old path that is no file (`/invite/<code>`, `/index.php`, `/files/download/democracy-app.apk`) gets the 404 page, whose script forwards it. Unknown states land on `/` like live. Aliases also get a static forwarding page from `src/app/[...alias]`. `resolveLegacyUrl()` is serialised with `toString()`: keep it free of inner functions, callbacks and outside references (a unit test guards this). `BlogQueryScript` forwards the WordPress short links `?p=` on `/blog/`.
- **Server** (Apache on Plesk, see [`docs/hosting-plesk.md`](docs/hosting-plesk.md)): `out/.htaccess` (`src/lib/htaccess.ts`, built from the same data) answers with 301/302 before any HTML loads: states and aliases from `routes.yaml`, every rule of `legacy-paths.ts`, WordPress queries (`?p=`, `?cat=`, `?author=`, `?tag=`, `?m=`, `?feed=`) from `content/blog/`, plus `api.php` as `application/json`, `ErrorDocument 404` and `X-Robots-Tag: noindex` on every host except production. Hash links never reach the server.

**`src/lib/legacy-paths.ts`** is the rule table for old paths outside the hash router (`index.php`, invite links → `/`, Wahl-O-Meter spellings, APK/AAB → GitHub release with 302, `/blog/index.php`, `…/page/1/`, Atom/RDF feeds): `from` is a regex on the path without leading slash that JavaScript and PCRE read the same way, `to` a path or absolute URL with `$1`… (only in the path), `status`, `ignoreCase`, `dropQuery`. `buildHtaccess()` adds a loop guard when a rule matches its own target.

**`tests/legacy-urls.ts`** lists every kind of old URL with the place a visitor ends up (`to`, null = 404 page) and the first answer of Apache (`server`). `tests/e2e/legacy-urls.spec.ts` and `tests/basepath/legacy-urls.spec.ts` open each one on a static host (`client: "file"` only requests it, `client: false` marks the few WordPress query forms only Apache forwards); `pnpm check-htaccess [url]` requests each one from Apache (`pnpm serve-apache` locally, or the test host). A new old URL goes into `routes.yaml` (state, alias) or `legacy-paths.ts`, and with an example into `tests/legacy-urls.ts`. `serve` (e2e) does not add the trailing slash of directories like GitHub Pages and Apache do; the check accepts both spellings when that is the only difference.

## MDX gotchas

- `MdxPage` renders the `og:*` `<meta>` tags _after_ the content. React hoists them into `<head>`; as the first DOM node of a page they made Next.js skip its scroll to the top after a navigation (the page kept the old scroll position). Keep hoistable elements (`<meta>`, `<link>`, `<title>`) out of the first position of a page.
- `MdxPage` passes `blockJS: false`; next-mdx-remote v6 otherwise drops every JS expression (`style={{…}}`, `subtitle={<>…</>}`) without an error.
- Children on the same line as the tag stay inline; children on their own lines become `<p>` paragraphs. Use props (e.g. `InfoBadge action/text`) when the original has no `<p>`.
- Literal JSX tags (`<h1 style={{…}}>`) are not mapped through `mdxComponents`; Markdown links are (→ `Link`).
- `content/pages/*.mdx` is excluded from Prettier: its MDX 1 parser re-indents nested JSX and changes whitespace.
- Original markup that mixes text with block elements inside an inline element (e.g. `<span>` around `<h5>`, `<div class="row">`, unclosed spans the browser closes at `</div>`): write the whole element on **one line**. MDX then treats it as phrasing content and renders the DOM as written, without `<p>`. Rebuild the DOM the browser parsed, not the raw template.
- Literal `<a>` and `<img>` in MDX get no basePath: use `Link` (also for `/files/download/…` with `target="_blank"`) and `Img`. External links may stay literal `<a>`.
- Old HTML attributes React does not know keep their lowercase spelling in MDX (`allowtransparency="true"` on the Discord iframe); the camelCase form logs an error.
- Inline `<style>` blocks of a template: in MDX a template literal as child, ``<style>{`…`}</style>``, or a constant in the component.
- MDX inside YAML (FAQ answers): rendered with `MDXRemote` and `p` mapped to a fragment, so the answer stays one paragraph without `<p>` like the old HTML. Line breaks as `<br />`, lists as `<ul><li>…</li></ul>`, internal links as Markdown links; a blank line would silently join two paragraphs, so the schema rejects it.
- Numbers from YAML inside MDX texts: pass the text with `{placeholder}`s as a prop (`DonateBox progress="{percentage}% von {valueGoal}€ GESCHAFFT!"`); the component fills them and fails the build on unknown names.
- No optional chaining in MDX expressions. Inside JSX attribute values the German closing quote must be `“` (U+201C), never ASCII `"`.

## MDX components

| Component                               | Purpose                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `Link`                                  | internal/external link (also used for Markdown links)                               |
| `Section`                               | `.background-white > .container.page` wrapper; `raised`, `style`, `after`           |
| `AppHeader`                             | blue header of home/wahlometer (`variant`), store badges, APK/AAB links from YAML   |
| `ScrollIcon`                            | chevron below the header, scrolls to the first `#about`                             |
| `VideoSection`                          | video title (three parts or `title`), link and YouTube HD thumbnail                 |
| `PressLogos` / `PressLogo`              | "bekannt aus" logo row                                                              |
| `RectangleInfo`                         | grey rotated title box with text and link                                           |
| `FeatureVideos` / `InfoBadge`           | home: info badges switching the phone video (client)                                |
| `SymbolInfoPanel` / `SymbolInfo`        | wahlometer: three symbol tiles                                                      |
| `ComparisonAccordion` / `ComparisonRow` | two-column accordion (wahlometer, about); titles may hold markup (client)           |
| `WhyUs`, `Campaign`, `CampaignCorner`   | wahlometer: "Warum gibt es uns?", campaign block with badges, corner image          |
| `Img`                                   | plain `<img>` with basePath, `alt=""` by default                                    |
| `DonateBox`                             | donate: progress and sponsorship box (donate_box.tpl), figures from YAML            |
| `DonateDetails`                         | donate: progress, value box and cost table with bars (donate_details.tpl)           |
| `Modal` / `ModalToggle`                 | Bootstrap 4 modal markup / its `data-toggle="modal"` button (client)                |
| `Team`                                  | about: team cards from `team.yaml`; hover swaps text and contact links (client)     |
| `ServicesIcon`                          | about: icon, title and subtitle of "Unsere Philosophie" (icon.tpl)                  |
| `PressMedia`                            | press: tiles of one list of `media.yaml` (`list="kit"`, `articles`, `publications`) |
| `BlogTeasers`                           | press: tiles of the newest blog posts (`count={9}`), linked to their permalink      |
| `Faq`                                   | faq: category menu and questions from `faq.yaml`; filter and collapse (client)      |
| `ContactForm`                           | contact: form of default_contact.tpl, checks and sending (client, see "Forms")      |
| `LegalText`                             | legal pages: `content/legal/<name>.md` as Markdown with HTML (`name="impressum"`)   |
| `Roadmap`                               | engineering: roadmap table from `roadmap.yaml`, icons via `iconClass()`             |
| `BugReportForm`                         | engineering: bug report form, checks, sending, screenshot notice (see "Forms")      |
| `VolunteerForm`                         | engineering: volunteer form with checkboxes (`roles`, `feature`) (client)           |
| `Hotspot`                               | citizen/politicians: numbered hotspot with Bootstrap tooltip (client)               |
| `BlogFrame`                             | blog page: the blog in an iframe, height follows each load like resizeIframe()      |

Client components read declarative children (`InfoBadge`, `ComparisonRow`) via `Children.toArray(...).props`.

## Testing and tooling gotchas

- Blog tests read expected values from `content/blog/` (`getBlogPosts()`, `missing-uploads.yaml`); images with `loading="lazy"` only load near the viewport, set them to eager before checking `naturalWidth`.
- Playwright projects: `desktop` (1280 px) and `mobile` (375 px, files `*.mobile.spec.ts`), server `serve out` on port 3100; `tests/basepath` serves the basePath build via `scripts/serve-basepath.mjs` on 3101. Take expected values from the YAML (`contentYaml()`), never from live.
- Scroll assertions: `waitForScrollEnd()`; scroll an element into view and wait for `.navbar.scrolled` before clicking when the handler reads the navbar height.
- tsx (esbuild) wraps nested functions in a `__name` helper. Code that runs in the browser via `page.evaluate` in `scripts/` goes in as a string; avoid backslashes inside those template strings.
- tsx (esbuild) also cooks escape sequences in `String.raw` templates (`\u00e1` becomes `á`). Write expected escaped strings with doubled backslashes in normal strings.
- Tests must not hard-code donation figures: compute expected values from `donation.yaml` with the helpers of `src/lib/donation.ts`, so updating the figures keeps the tests green. The comparison with the live API uses the inputs of the saved live response.
- PHP reference values: a local `php:7.4-cli` Docker image (live runs 7.4.33) is the oracle; pipe the script in (`docker run --rm -i php:7.4-cli php < script.php`), the scratchpad is not mounted.

## Conventions

- UI content German; code, comments and identifiers English.
- Commit finished, self-contained changes promptly, concise English subjects, scoped to one change. A pre-commit hook runs `pnpm lint`.
- Run `pnpm format` after editing (MDX pages and `public/css` are excluded).
- After new patterns, components or gotchas: update this file and `.github/instructions/` in the same change.

# Next.js Version Notice

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
