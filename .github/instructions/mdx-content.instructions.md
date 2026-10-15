---
description: "Guidelines for editing MDX page files of the DEMOCRACY website: frontmatter, section components, whitespace and German quotes."
applyTo: "content/**/*.mdx"
---

# MDX Content Editing Guide

Component list and gotchas: `AGENTS.md` ("MDX components", "MDX gotchas").

## Frontmatter

```yaml
---
state: wahlometer # state of the old hash router, must exist in content/site/routes.yaml
# optional, only where live differs from content/site/head.yaml:
# title: "…"
# meta: { DC.Description: "…" }
# openGraph: { description: "…" }
---
```

## Rules

- The text must match the live page word for word (`pnpm compare <path>` checks it against `?_escaped_fragment_`).
- Write text as props or Markdown children of the section components; keep the order of the original template.
- Children on the same line as the tag stay inline, children on their own lines become `<p>`. Pick the form the original has.
- Inline elements that contain block markup in the original (`<span>` around `<h5>` or `<div>`): write the whole element on one line, so MDX keeps the parsed DOM without `<p>`.
- Links and images to files under `public/` use `Link` and `Img` (basePath), never literal `<a>`/`<img>`.
- Numbers from YAML (donation status) appear in texts as `{placeholder}`s inside props, e.g. `progress="{percentage}% von {valueGoal}€ GESCHAFFT!"`.
- Internal links use the new paths (`/ueber-uns/`, `/wahlometer/#wom-campaign-container`), never `#!state`.
- JS expressions in props are allowed (`style={{ minHeight: "unset" }}`, `subtitle={<>… <br />…</>}`), optional chaining is not.
- Inside JSX attribute values the German closing quote must be `“` (U+201C), never ASCII `"`.
- No embeds of other hosts (iframes, scripts, images from a CDN): videos are `<VideoSection youtube="<video id>" …>` with the thumbnail in `public/files/youtube/<id>.jpg`, the Discord widget is `<DiscordWidget …>`; both load the third party only after a click.
- HTML attributes React does not know stay lowercase (`allowtransparency="true"`).
- Bootstrap tooltips: `<Hotspot className="…" title="…">1</Hotspot>`; the title goes into `data-original-title` like after `.tooltip()`. HTML comments of a template become MDX comments `{/* … */}`.
- Inline `<style>` blocks of a template: a template literal as child, ``<style>{`…`}</style>``.
- Structured data (team, donation figures, press media, FAQ, roadmap) lives in YAML, not in the MDX text. FAQ answers in `content/faq/faq.yaml` are MDX in one paragraph: `<br />` for line breaks, no blank lines.
- Legal texts are not MDX: `content/legal/<name>.md` is plain Markdown with inline HTML (`<br>`, `<ol style="…">`), rendered by `<LegalText name="…" />`. Keep the wording word for word (README, "Updating the legal texts").
- Page MDX is not formatted by Prettier; keep the indentation by hand.
- After editing: `pnpm validate-content` and `pnpm build`.
