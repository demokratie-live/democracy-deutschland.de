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
public/
  css/                  original CSS (see "CSS"); files/  assets under the old /files/ paths
  videos/  favicon.ico  manifest.json
src/
  app/                  thin page shells: <MdxPage id="…" />; [...alias] forwarding pages; not-found
  components/frame/     Navbar, Footer, ToTop (UItoTop), LegacyRedirectScript
  components/shared/    sections used by several modules (AppHeader, Section, Link, VideoSection, …)
  components/<module>/  sections of one module (home/, wahlometer/, …)
  components/mdx/       MdxPage (render + head), MDXComponents (registry)
  lib/                  animate.ts (jQuery animations), legacy-redirect.ts, metadata.ts,
                        routes.ts, stylesheets.ts, base-path.ts, content/ (loaders), schemas/
scripts/                validate-content.ts, compare.ts, serve-basepath.mjs
tests/e2e/, tests/basepath/
```

## Porting a module

1. **Read the original**: tpl, the module's `init_<state>()` JS and CSS, then the live DOM _after_ init (DevTools on `#!<state>`). jQuery init leaves inline styles and moved markup behind; the port renders that final state, not the raw template.
2. **Assets**: copy what the page uses from `democracy/files/<cat>/` to `public/files/<cat>/` under the same name. Reference them as `/files/<cat>/<name>` through `asset()` (raw tags) or `Link` (anchors).
3. **Components**: one section component per template block in `src/components/<module>/` (or `shared/` when two modules use it), registered in `src/components/mdx/MDXComponents.tsx`. Original classes and ids stay, duplicates included. Text goes into `content/pages/<id>.mdx` as props or Markdown children.
4. **Page**: `src/app/<path>/page.tsx` as a thin shell (copy `src/app/wahlometer/page.tsx`). The state and path already exist in `routes.yaml`; head overrides go into the frontmatter.
5. **Interactions** in React, no jQuery. Use `src/lib/animate.ts` (`animateScrollTo`, `tween`, easings `swing`/`easeOutQuart`, `SLOW` = 600 ms) to match jQuery timing.
6. **Verify**, all until green or explained:
   - `pnpm compare <path>` against a running local server (`pnpm dev` or `pnpm build && pnpm start`, default `--local http://localhost:3000`); use `--click <selector>` for every interaction state and `--only mobile` for mobile-only states. Pixels, visible text, `#content` text against `?_escaped_fragment_` and head data must match; explain every remainder in `docs/abweichungen.md`.
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

## Routing and legacy links

`routes.yaml` is the single source for paths. `LegacyRedirectScript` inlines `resolveLegacyUrl()` into `<head>` and forwards `#!<state>`, `#!<state>#<anchor>`, `?page=<state>`, `?_escaped_fragment_=<state>` and `aliases` before rendering, and again on `hashchange`. Unknown states land on `/` like live. Aliases also get a static forwarding page from `src/app/[...alias]`. `resolveLegacyUrl()` is serialised with `toString()`: keep it free of inner functions and outside references (a unit test guards this).

## MDX gotchas

- `MdxPage` passes `blockJS: false`; next-mdx-remote v6 otherwise drops every JS expression (`style={{…}}`, `subtitle={<>…</>}`) without an error.
- Children on the same line as the tag stay inline; children on their own lines become `<p>` paragraphs. Use props (e.g. `InfoBadge action/text`) when the original has no `<p>`.
- Literal JSX tags (`<h1 style={{…}}>`) are not mapped through `mdxComponents`; Markdown links are (→ `Link`).
- `content/pages/*.mdx` is excluded from Prettier: its MDX 1 parser re-indents nested JSX and changes whitespace.
- No optional chaining in MDX expressions. Inside JSX attribute values the German closing quote must be `“` (U+201C), never ASCII `"`.

## MDX components

| Component                               | Purpose                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `Link`                                  | internal/external link (also used for Markdown links)                             |
| `Section`                               | `.background-white > .container.page` wrapper; `raised`, `style`, `after`         |
| `AppHeader`                             | blue header of home/wahlometer (`variant`), store badges, APK/AAB links from YAML |
| `ScrollIcon`                            | chevron below the header, scrolls to the first `#about`                           |
| `VideoSection`                          | "Worum geht es …" title, link and YouTube HD thumbnail                            |
| `PressLogos` / `PressLogo`              | "bekannt aus" logo row                                                            |
| `RectangleInfo`                         | grey rotated title box with text and link                                         |
| `FeatureVideos` / `InfoBadge`           | home: info badges switching the phone video (client)                              |
| `SymbolInfoPanel` / `SymbolInfo`        | wahlometer: three symbol tiles                                                    |
| `ComparisonAccordion` / `ComparisonRow` | wahlometer: Wahl-O-Mat vs. Wahl-O-Meter accordion (client)                        |
| `WhyUs`, `Campaign`, `CampaignCorner`   | wahlometer: "Warum gibt es uns?", campaign block with badges, corner image        |

Client components read declarative children (`InfoBadge`, `ComparisonRow`) via `Children.toArray(...).props`.

## Testing and tooling gotchas

- Playwright projects: `desktop` (1280 px) and `mobile` (375 px, files `*.mobile.spec.ts`), server `serve out` on port 3100; `tests/basepath` serves the basePath build via `scripts/serve-basepath.mjs` on 3101. Take expected values from the YAML (`contentYaml()`), never from live.
- Scroll assertions: `waitForScrollEnd()`; scroll an element into view and wait for `.navbar.scrolled` before clicking when the handler reads the navbar height.
- tsx (esbuild) wraps nested functions in a `__name` helper. Code that runs in the browser via `page.evaluate` in `scripts/` goes in as a string; avoid backslashes inside those template strings.

## Conventions

- UI content German; code, comments and identifiers English.
- Commit finished, self-contained changes promptly, concise English subjects, scoped to one change. A pre-commit hook runs `pnpm lint`.
- Run `pnpm format` after editing (MDX pages and `public/css` are excluded).
- After new patterns, components or gotchas: update this file and `.github/instructions/` in the same change.

# Next.js Version Notice

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
