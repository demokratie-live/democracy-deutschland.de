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

| Command                     | What it does                                                                    |
| --------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`                  | Dev server with Turbopack                                                       |
| `pnpm build`                | Static export to `out/`                                                         |
| `pnpm start`                | Serve `out/` on port 3000                                                       |
| `pnpm validate-content`     | Validate MDX/YAML against the Zod schemas and internal links                    |
| `pnpm compare <path>`       | Screenshots, text and head data of a local page against the live site           |
| `pnpm import-blog`          | Import the WordPress blog into `content/blog/` and `public/blog/`               |
| `pnpm compare-blog-dom`     | DOM of every blog page against the live blog                                    |
| `pnpm compare-blog-feed`    | Every blog feed against the live feed                                           |
| `pnpm compare-blog-search`  | Hits and order of the client search against the live search                     |
| `pnpm serve-apache`         | Serve `out/` with a local Apache 2.4 so `out/.htaccess` applies (`stop` to end) |
| `pnpm check-htaccess [url]` | Check the server-side redirects of `out/.htaccess` (local Apache or a host)     |
| `pnpm lint`                 | ESLint                                                                          |
| `pnpm format`               | Prettier (MDX pages and the original CSS are excluded)                          |
| `pnpm test:unit`            | Unit tests                                                                      |
| `pnpm test:e2e`             | Build and run the Playwright tests (desktop and mobile)                         |
| `pnpm test:basepath`        | Build with the GitHub Pages basePath and test assets and redirects there        |

`pnpm compare /wahlometer/ --local http://localhost:3000` writes its results to
`compare-results/wahlometer/index.html`. `--click <selector>` compares the state after a
click, `--hover <selector>` the visible area while the mouse is on an element,
`--live-eval <js>` runs JavaScript on the live page first (to reproduce an intended
deviation).

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

## Updating the press page

The tiles of `/presse/` come from [`content/press/media.yaml`](content/press/media.yaml)
(before: table `media` in the SAI), one list per section in the order of the file:
`kit` ("Presse-Kit"), `articles` ("Pressespiegel"), `publications` ("Publikationen").
Each entry has a `title`, a `link` (external URL or a file such as
`/files/download/…`, opened in a new tab) and an `img` under `public/files/medien/`.
Put new images and downloads under `public/files/medien/` and `public/files/download/`.

The "Blogs" tiles are not maintained here: they show the nine newest posts of
`content/blog/` with title, featured image and permalink (see "Updating the blog").

`pnpm validate-content` checks the schema and that every image and download exists.

## Updating the FAQ

Questions, answers and the category menu of `/faq/` live in
[`content/faq/faq.yaml`](content/faq/faq.yaml) (before: table `faq` in the SAI). The
first question is open when the page loads.

- `menu`: the items on the left; an item without `category` shows all questions.
- `questions`: in display order, each with `question`, `categories` (from `menu`) and
  `answer`. The answer is MDX in one paragraph, like the HTML of the old table: line
  breaks as `<br />` (no blank lines), lists as `<ul><li>…</li></ul>`, internal links as
  `[text](/datenschutz/)`, external ones as `<a href="…" target="_blank">…</a>`.

`pnpm validate-content` checks the categories, blank lines and internal links.

## Updating the legal texts

Impressum, Datenschutz and Nutzungsbedingungen live in
[`content/legal/`](content/legal/) as `impressum.md`, `datenschutz.md` and
`nutzungsbedingungen.md` (before: `system_text` in the SAI, edited with TinyMCE). They
are plain Markdown (CommonMark, not MDX), rendered into the page frame of
`content/pages/<name>.mdx`.

- Headings, paragraphs, bullet lists and links are Markdown. Bold headings are written
  `#### **Titel**` like the old editor output.
- HTML only where Markdown cannot produce the live layout: `<br>` inside headings and at
  the end of paragraphs (the blank lines of the old texts), the lettered lists
  `<ol style="list-style-type: lower-alpha;"><li>…</li></ol>`, text outside a paragraph
  in `<span>` on its own lines, links with `target="_blank"`. Inside such HTML blocks
  Markdown does not work, write links as `<a href="…">`.
- Non-breaking spaces stay visible as `&nbsp;`. Some umlauts are stored decomposed
  (`u` + combining diaeresis), as on live; they look the same.
- Internal links use the new paths (`/datenschutz/`).

`pnpm validate-content` checks the internal links. `tests/e2e/legal.spec.ts` compares the
words of each page with the live responses saved on 2026-10-13
(`tests/fixtures/<name>.live.html`). Until the domain moves to the static site, live is
the source: if a text changes there, save the new `?_escaped_fragment_=<name>` response
as the fixture and update the Markdown until the test passes. After the move the
Markdown is the source and the comparison with the old live state can go.

## Updating the roadmap

The roadmap table of `/engineering/` lives in
[`content/engineering/roadmap.yaml`](content/engineering/roadmap.yaml) (before: table
`roadmap` and the texts tagged "roadmap" in the SAI).

- `columns`: head of the three status columns (`beta`, `mvp`, `dream`) with `text`, the
  line below it (`date`) and its colour (`blue`, `grey`, `red`, `green`, `black`).
- `goals`: one row per entry in display order with `goal`, optional `sub: true`
  (indented sub item), `bold: true` and `issue` (GitHub issue number of democracy-client,
  shown as `#123`), and the status codes `beta`, `mvp`, `dream` of the old SAI: `0` is an
  empty cell, `1` a blue and `2` a grey check mark. The other codes of
  `icon_class()` (tens = icon, ones = colour) are listed at the top of the file.

`pnpm validate-content` rejects unknown status codes and colours.

## Updating the blog

The blog under `/blog/` is a copy of the WordPress blog (theme Lovecraft). While
WordPress still runs, posts are written there and imported:

```bash
pnpm import-blog            # cached: only new or changed pages are fetched
pnpm import-blog --refresh  # fetch everything again (posts, pages, uploads)
pnpm validate-content
pnpm build && pnpm start    # then: pnpm compare-blog-dom, compare-blog-feed, compare /blog/…
```

The script reads the public REST API and the rendered post pages (read-only, one
request after another), writes every post to `content/blog/<slug>.md` (frontmatter +
Markdown, HTML where Markdown cannot reproduce WordPress), `taxonomy.yaml`, `media.yaml`
and the referenced uploads under `public/blog/wp-content/uploads/` (all srcset sizes),
and removes posts and uploads that are gone. It checks itself: every block must render
back to the WordPress DOM. It stops with a message when something new appears (a
title typography rule, a new block style); fix the script, don't edit the output.
Blog settings that are not in the REST API (header image, posts per page) are in
`content/blog/site.yaml`. Uploads that are already missing on live are listed in
`content/blog/missing-uploads.yaml`. Archives, feeds and the search index
(`/blog/search-index.json`) are built from `content/blog/` on every build; nothing to
maintain. Details: `AGENTS.md`, "Blog".

## Forms

The contact form (`/kontakt/`) and the bug report and volunteer forms on `/engineering/`
check the fields like the old site (alert texts in
[`content/site/forms.yaml`](content/site/forms.yaml)) and then

- open a prefilled mail to `contact@democracy-deutschland.de` in the visitor's mail
  program (default), or
- POST the fields as JSON to an endpoint when its variable is set at build time:
  `NEXT_PUBLIC_CONTACT_ENDPOINT`, `NEXT_PUBLIC_BUGREPORT_ENDPOINT`,
  `NEXT_PUBLIC_VOLUNTEER_ENDPOINT` (e.g. `NEXT_PUBLIC_CONTACT_ENDPOINT=https://… pnpm build`).

The endpoint contract (JSON body, success = HTTP 2xx, CORS) is in
[`docs/server-funktionen.md`](docs/server-funktionen.md#formulare-send_mail). The bug
report has no file picker (there is no upload server); a notice below the text field asks
for screenshots by mail. Its two wordings (with and without endpoint) are the props
`attachMailto` and `attachEndpoint` in
[`content/pages/engineering.mdx`](content/pages/engineering.mdx).

## Documentation

- [`AGENTS.md`](./AGENTS.md) – architecture, rules for 1:1 markup, porting steps, gotchas
- [`docs/abweichungen.md`](./docs/abweichungen.md) – deviations from the live site and fixed bugs
- [`docs/server-funktionen.md`](./docs/server-funktionen.md) – server functions of the old site and their replacement
- [`docs/hosting-plesk.md`](./docs/hosting-plesk.md) – hosting on Plesk: `.htaccess`, `api.php`, deploy via Plesk-Git and the branch `deploy`, switching production
