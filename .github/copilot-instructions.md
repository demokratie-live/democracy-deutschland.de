# DEMOCRACY Deutschland – Repository Overview

This repository contains the website of **DEMOCRACY Deutschland e.V.**: a static 1:1 port of the PHP site [democracy-deutschland.de](https://democracy-deutschland.de) (repo `demokratie-live/democracy-website`) to Next.js. Every page must look and behave exactly like the live site; only clear bugs are fixed and documented.

`AGENTS.md` is the single source of truth for architecture, the rules for 1:1 markup, the steps to port a module and all gotchas. Read it before changing code or content.

## Key Facts

- **Tech stack**: Next.js 16 (App Router, static export), React 19, TypeScript strict, original Bootstrap 4.0.0 / Font Awesome CSS from the PHP site, Zod v4, pnpm. No Tailwind, no jQuery.
- **Reference**: the live site is the truth for content and behaviour (`/#!<state>`, `/?_escaped_fragment_=<state>`); access it read-only.
- **Content**: page texts in `content/pages/*.mdx`, site data in `content/site/*.yaml`, donation status (page and app JSON `/api.php`) in `content/donate/donation.yaml`, team of `/ueber-uns/` in `content/team/team.yaml`, press tiles in `content/press/media.yaml`, FAQ in `content/faq/faq.yaml`, roadmap of `/engineering/` in `content/engineering/roadmap.yaml`, legal texts (Markdown) in `content/legal/`, form texts in `content/site/forms.yaml`, blog posts in `content/blog/` (frontmatter stubs until the blog import).
- **Docs**: deviations in `docs/abweichungen.md`, server needs in `docs/server-funktionen.md`.
- **Languages**: UI content German; code, comments, identifiers and commit messages English. The user communicates in German; answer in German.
- **Commits**: commit finished, self-contained changes promptly with a concise English subject; do not bundle unrelated files.

## Verification

```bash
pnpm lint && pnpm validate-content && pnpm test:unit
pnpm test:e2e          # build + Playwright (desktop and mobile)
pnpm test:basepath     # build with GitHub Pages basePath + Playwright
pnpm compare <path>    # local page against live: screenshots, text, head
```
