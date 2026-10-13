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
  blog/<slug>.md        blog posts (WordPress); until the blog import only frontmatter stubs (see "Blog posts")
public/
  css/                  original CSS (see "CSS"); files/  assets under the old /files/ paths
  blog/wp-content/uploads/  blog media under their WordPress paths
  videos/  favicon.ico  manifest.json
src/
  app/                  thin page shells: <MdxPage id="…" />; [...alias] forwarding pages; not-found;
                        api.php/, api/donation_status.json/: static GET route handlers (app JSON)
  components/frame/     Navbar, Footer, ToTop (UItoTop), LegacyRedirectScript
  components/shared/    sections used by several modules (AppHeader, Section, Link, VideoSection, …)
  components/<module>/  sections of one module (home/, wahlometer/, donate/, about/, contact/, legal/, engineering/, …)
  components/mdx/       MdxPage (render + head), MDXComponents (registry)
  lib/                  animate.ts (jQuery animations), legacy-redirect.ts, metadata.ts,
                        routes.ts, stylesheets.ts, base-path.ts, content/ (loaders), schemas/,
                        bootstrap-modal.ts (Bootstrap 4 modal), bootstrap-collapse.ts (Bootstrap 4
                        collapse), bootstrap-tooltip.ts (Bootstrap 4 tooltip, Popper.js 1.12.9),
                        roadmap.ts (icon_class()), donation.ts (PHP round/number_format/json_encode, donation
                        JSON), donation-route.ts, content/blog.ts (blog posts, permalinks),
                        forms.ts (validateEmail, form checks, endpoint or mailto)
scripts/                validate-content.ts, compare.ts, serve-basepath.mjs
tests/e2e/, tests/basepath/, tests/fixtures/ (saved live responses, byte for byte: app JSON, legal texts)
```

## Porting a module

1. **Read the original**: tpl, the module's `init_<state>()` JS and CSS, then the live DOM _after_ init (DevTools on `#!<state>`). jQuery init leaves inline styles and moved markup behind; the port renders that final state, not the raw template.
2. **Assets**: copy what the page uses from `democracy/files/<cat>/` to `public/files/<cat>/` under the same name. Reference them as `/files/<cat>/<name>` through `asset()` (raw tags) or `Link` (anchors).
3. **Components**: one section component per template block in `src/components/<module>/` (or `shared/` when two modules use it), registered in `src/components/mdx/MDXComponents.tsx`. Original classes and ids stay, duplicates included. Text goes into `content/pages/<id>.mdx` as props or Markdown children.
4. **Page**: `src/app/<path>/page.tsx` as a thin shell (copy `src/app/wahlometer/page.tsx`). The state and path already exist in `routes.yaml`; head overrides go into the frontmatter.
5. **Interactions** in React, no jQuery. Use `src/lib/animate.ts` (`animateScrollTo`, `tween`, easings `swing`/`easeOutQuart`, `SLOW` = 600 ms) to match jQuery timing. Bootstrap 4.0.0 plugins are ported to plain DOM code with the original timings: Collapse in `Navbar` and as `useCollapseTransition()`/`prepareHide()` in `src/lib/bootstrap-collapse.ts` (state in React, see `FaqList`), Modal in `src/lib/bootstrap-modal.ts` (markup server-rendered with `Modal`, opened by `ModalToggle` like the data API), Tooltip in `src/lib/bootstrap-tooltip.ts` (element server-rendered in the state after `_fixTitle()`, i.e. `title=""` and `data-original-title`; the tip is appended to `<body>` and placed by the same Popper.js 1.12.9 as live, see `Hotspot`; `dispose()` on unmount). Inline `<script>`s of a template become a client component that renders `null` and runs the script in an effect (`UpdateProgress`).
6. **Verify**, all until green or explained:
   - `pnpm compare <path>` against a running local server (`pnpm dev` or `pnpm build && pnpm start`, default `--local http://localhost:3000`); use `--click <selector>` for every interaction state, `--hover <selector>` for hover states (viewport only, a full-page screenshot loses the hover), `--only mobile` for mobile-only states, `--files <selector>` to put two test files into a file input (live: `XMLHttpRequest` is stubbed first) and `--live-eval <js>` to reproduce an intended deviation on live before comparing (e.g. remove the FAQ entry the port drops), so the rest still compares pixel by pixel. The tool aborts the old API's writing calls on live (`send_mail`, `upload`, `beta`, `send_subscribe`); stub `sendMail`/`$.ajax` with `--live-eval` before clicking a form button anyway. Pixels, visible text, `#content` text against `?_escaped_fragment_` and head data must match; explain every remainder in `docs/abweichungen.md`.
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
- **Files (bug report)**: picker and drag & drop run only the visible part of the old `upload()` (progress bar at 0 %, yellow entries, no request); `files` in the data object is `{ <lastModified>: { file: {} } }` like live before a server response. No upload server (decision Manuel 2026-10-13, follow-up TASK-88).
- **Tests**: the mailto path in `tests/e2e` (`page.waitForRequest((r) => r.url().startsWith("mailto:"))`, compare decoded, Chromium escapes `'`), the endpoint path in `tests/basepath` (that build sets the endpoint variables, `page.route` answers). File picker: `page.waitForEvent("filechooser")`; drag & drop: dispatch a `DragEvent("drop")` with a `DataTransfer` built in the page. Register `page.on/once("dialog")` before the click that raises an alert; awaiting `waitForEvent("dialog")` after starting the click deadlocks.

## Legal texts

`content/legal/<name>.md` holds the old `system_text` (`impressum_text`, …) as plain Markdown (CommonMark, not MDX). `LegalText` renders it with `MDXRemote` and `mdxOptions: { format: "md", rehypePlugins: [rehypeRaw] }`, so raw HTML (`<br>`, `style="…"`) works without JSX syntax; `a` is mapped to `Link`. The page frame of the template is `content/pages/<name>.mdx`.

- Markdown where the DOM stays the same, HTML only where Markdown cannot express the live layout (decision Manuel 2026-10-13): `<br>` in headings and at the end of blocks, `<ol style="list-style-type: lower-alpha;">`, text directly in the container as `<span>` on its own lines (an HTML block; Markdown would wrap it in `<p>` and add a margin). HTML blocks end at a blank line and contain no Markdown.
- Editor leftovers without effect are dropped (`data-mce-*`, `style="font-weight: 400;"`, attribute-less `<span>`, the `div title="Page 1"` wrapper); words, `&nbsp;` and decomposed umlauts stay exactly as on live. `**x **` does not close in Markdown: move the space outside.
- `tests/e2e/legal.spec.ts` compares the words of each page (text nodes, `<br>`/blocks as spaces) with `tests/fixtures/<name>.live.html`, loaded via `page.setContent` with all requests aborted. Fixtures are excluded from Prettier (`tests/fixtures/*.live.*`).

## Generated files (app JSON)

`/api.php` and `/api/donation_status.json` are App Router route handlers (`export const dynamic = "force-static"`, `GET` re-exported from `src/lib/donation-route.ts`); `next build` writes them as files into `out/`. The body is byte-identical to the old `api.php?call=donation_status` (PHP 7.4 `round()`, `json_encode()` escaping; only `querytime` is 0). `src/lib/donation.test.ts` checks this against `tests/fixtures/donation_status.live.json` and PHP reference values. Static hosts ignore the query string and serve `.php` as `application/x-httpd-php`; the app parses it anyway (`docs/server-funktionen.md`). Keep these routes static: no request data, no other HTTP methods.

## Blog posts and the press teasers

`content/blog/<slug>.md` holds one WordPress post per file, frontmatter per `src/lib/schemas/blog.ts` (`wpId`, `title`, `slug`, `date`, `author`, `categories`, `tags`, `image`). Until the blog import (TASK-80) the directory only has frontmatter stubs of the nine newest posts; their featured images are the original uploads under `public/blog/wp-content/uploads/<year>/<month>/`, the path the import uses.

- `getBlogPosts()` / `getLatestBlogPosts(limit)` in `src/lib/content/blog.ts` read all files, newest `date` first (`post_date DESC` like `wp_get_recent_posts()`); `blogPermalink()` builds `/blog/<year>/<month>/<slug>/` from `date` and `slug`. `BlogTeasers` on `/presse/` uses them; the import only has to write the files.
- `title` is the raw `post_title` as the press page shows it (`'25`, not `’25`). The REST API only returns `title.rendered`: wptexturize writes its replacements as numeric entities (`&#8217;25`), characters typed that way stay literal (`’22`), so the raw title can be recovered (`&#8216;`/`&#8217;` → `'`, `&#8220;`/`&#8221;` → `"`; `&#8211;`/`&#8212;` stand for `-`/`--`, check the post). Blog pages apply wptexturize when rendering, like WordPress.
- `date` is `post_date` (local time) as a quoted string; unquoted YAML dates become `Date` objects and fail validation.

## Routing and legacy links

`routes.yaml` is the single source for paths. `LegacyRedirectScript` inlines `resolveLegacyUrl()` into `<head>` and forwards `#!<state>`, `#!<state>#<anchor>`, `?page=<state>`, `?_escaped_fragment_=<state>` and `aliases` before rendering, and again on `hashchange`. Unknown states land on `/` like live. Aliases also get a static forwarding page from `src/app/[...alias]`. `resolveLegacyUrl()` is serialised with `toString()`: keep it free of inner functions and outside references (a unit test guards this).

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
| `AlphaBadges`                           | engineering: store badges (`StoreBadge variant="2"`, hover) and button to `alpha`   |
| `BugReportForm`                         | engineering: bug report form, checks, sending, file list (client, see "Forms")      |
| `VolunteerForm`                         | engineering: volunteer form with checkboxes (`roles`, `feature`) (client)           |
| `Hotspot`                               | citizen/politicians: numbered hotspot with Bootstrap tooltip (client)               |

Client components read declarative children (`InfoBadge`, `ComparisonRow`) via `Children.toArray(...).props`.

## Testing and tooling gotchas

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
