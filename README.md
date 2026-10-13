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
`compare-results/wahlometer/index.html`. `--click <selector>` compares the state after a
click, `--hover <selector>` the visible area while the mouse is on an element.

## Updating the donation status

The figures of the donation page (`/spenden/`) and the JSON the app reads
(`https://democracy-deutschland.de/api.php?call=donation_status`, also served as
`/api/donation_status.json`) come from one file:
[`content/donate/donation.yaml`](content/donate/donation.yaml). It replaces the text
"donation" and the table `donate` of the old SAI; the keys are those of the JSON.

1. Edit `content/donate/donation.yaml`:
   - `donation_date`: free text, shown as "Stand: …" and passed to the app unchanged
     (format so far: `"14.06.2026 * 09:25 Uhr"`)
   - `donation_paten`, `donation_paten_goal`: sponsorships and their goal
   - `donation_value`, `donation_value_goal`: monthly donations in euros and the goal;
     the percentage is computed at build time, rounded like PHP
   - `donation_data`: one entry per table row. `type: 0` is a heading (only
     `text_description`), `type: 1` a cost with `value` of `max` euros covered. `order`
     sets the position, `id` stays unique and unchanged (the app uses it as key).

   Amounts are whole numbers without thousands separators (`3000`, not `3.000`). Quote
   texts that YAML would read as numbers (`"01.01.2024"`, `"2024"`).

2. Check: `pnpm validate-content` (schema: whole numbers, `max` > 0 for costs, unique
   `id` and `order`) and `pnpm test:unit`.
3. Commit and merge into `main`. The build writes the page and both JSON files; to look
   at the result locally, run `pnpm build` and open `out/api.php`.

The app only finds the JSON if the site is served at the domain root, see
[`docs/server-funktionen.md`](docs/server-funktionen.md#spenden-json-für-die-app).

## Updating the team

The cards under "Mitarbeiter" on `/ueber-uns/` come from
[`content/team/team.yaml`](content/team/team.yaml), in the order of the file (before,
the list was code in `default_about.php`). Per member:

- `name`, `text` (lines of the grey box, joined with a line break)
- `img`: photo under `public/files/wir/`; `imgHover` (optional): second photo while the
  mouse is over the card
- `links`: contact icons shown on hover, each with Font Awesome classes (`fa fa-envelope`,
  `fab fa-linkedin`, …) and a `mailto:`, `tel:` or `https://` URL

`pnpm validate-content` checks the schema and that every photo exists.

## Documentation

- [`AGENTS.md`](./AGENTS.md) – architecture, rules for 1:1 markup, porting steps, gotchas
- [`docs/abweichungen.md`](./docs/abweichungen.md) – deviations from the live site and fixed bugs
- [`docs/server-funktionen.md`](./docs/server-funktionen.md) – server functions of the old site and their replacement
