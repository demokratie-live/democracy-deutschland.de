---
description: "DEMOCRACY Deutschland project conventions for the static 1:1 port: original CSS and markup, content in MDX/YAML, routing table."
applyTo: "src/**/*.{ts,tsx},content/**/*.{md,mdx,yaml,yml}"
---

# DEMOCRACY Deutschland – Project Conventions

Details and reasons: `AGENTS.md`.

- **1:1 markup**: section components reproduce the DOM of the original templates _after_ the jQuery init functions, with the original classes, ids and inline styles. Styling comes only from the original CSS in `public/css/` (never edited); no Tailwind, CSS modules or new global CSS.
- **Pages** (`src/app/**/page.tsx`) are thin shells around `<MdxPage id="…" />`; text and section order live in `content/pages/<id>.mdx`.
- **Routing**: every path and old state is in `content/site/routes.yaml`; internal links use the new paths with trailing slash through `Link` from `src/components/shared/Link`. Raw asset URLs use `asset()`.
- **Interactions** in React without jQuery; jQuery timings via `src/lib/animate.ts`.
- **Schemas**: every content type has a Zod schema in `src/lib/schemas/`; run `pnpm validate-content`.
- **Static export**: no middleware, server actions or dynamic API routes. Files the old site generated (the app JSON `/api.php`) are static `GET` route handlers with `dynamic = "force-static"`. Server needs go into `docs/server-funktionen.md`.
- **SAI/database data** (donation status, team, press media, FAQ) lives in YAML under `content/`; blog posts are Markdown files in `content/blog/` (read via `src/lib/content/blog.ts`); values PHP computed use the PHP-compatible helpers in `src/lib/donation.ts`.
- **Forms** (contact, later bug report and volunteer): checks and alert texts 1:1 via `runChecks()` and `content/site/forms.yaml`; sending with `sendForm()` from `src/lib/forms.ts` to `NEXT_PUBLIC_<FORM>_ENDPOINT` or a prefilled `mailto:` (no alert, no reset after the mailto).
- **Legal texts** (Impressum, Datenschutz, Nutzungsbedingungen) are plain Markdown in `content/legal/`, HTML only where Markdown cannot reproduce the live layout; never change their wording (a test compares them with the saved live responses).
- **Verification**: `pnpm compare <path>` against live plus Playwright tests for every interaction; deviations into `docs/abweichungen.md`.
