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
- HTML attributes React does not know stay lowercase (`allowtransparency="true"`).
- Structured data (team, donation figures) lives in YAML, not in the MDX text.
- Page MDX is not formatted by Prettier; keep the indentation by hand.
- After editing: `pnpm validate-content` and `pnpm build`.
