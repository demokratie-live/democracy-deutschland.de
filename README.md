# DEMOCRACY Deutschland – Website

Static 1:1 port of [democracy-deutschland.de](https://democracy-deutschland.de) for
[DEMOCRACY Deutschland e.V.](https://democracy-deutschland.de), built with the Next.js
App Router and exported as static HTML. The pages use the original CSS (Bootstrap 4,
Font Awesome, the module stylesheets) and reproduce the original markup in React; all
texts and data live in MDX and YAML.

> **Conventions, architecture and how to port a module:** see [`AGENTS.md`](./AGENTS.md).

## Tech stack

- **Next.js 16** (App Router, `output: "export"`), **React 19**, **TypeScript** (strict)
- Original **Bootstrap 4.0.0** and **Font Awesome 5** CSS from the PHP site, no jQuery
- **MDX + YAML** for content, validated with **Zod v4**
- **Playwright** for end-to-end tests and the live comparison tool
- **pnpm** (v10+)

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Old links such as
`http://localhost:3000/#!wahlometer` forward to the new paths.

## Common commands

| Command                 | What it does                                                             |
| ----------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`              | Dev server with Turbopack                                                |
| `pnpm build`            | Static export to `out/`                                                  |
| `pnpm start`            | Serve `out/` on port 3000                                                |
| `pnpm validate-content` | Validate MDX/YAML against the Zod schemas and internal links             |
| `pnpm compare <path>`   | Screenshots, text and head data of a local page against the live site    |
| `pnpm lint`             | ESLint                                                                   |
| `pnpm format`           | Prettier (MDX pages and the original CSS are excluded)                   |
| `pnpm test:unit`        | Unit tests                                                               |
| `pnpm test:e2e`         | Build and run the Playwright tests (desktop and mobile)                  |
| `pnpm test:basepath`    | Build with the GitHub Pages basePath and test assets and redirects there |

`pnpm compare /wahlometer/ --local http://localhost:3000` writes its results to
`compare-results/wahlometer/index.html`.

## Documentation

- [`AGENTS.md`](./AGENTS.md) – architecture, rules for 1:1 markup, porting steps, gotchas
- [`docs/abweichungen.md`](./docs/abweichungen.md) – deviations from the live site and fixed bugs
- [`docs/server-funktionen.md`](./docs/server-funktionen.md) – server functions of the old site and their replacement
