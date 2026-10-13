import fs from "fs/promises";
import path from "path";

/**
 * Inline <style> blocks of the WordPress head, in live order. The texts are in
 * src/lib/blog/inline-css/ (written by `pnpm import-blog`, never edit them).
 * WordPress inlines the style of a block only on pages that render the block:
 * the sidebar widgets always, the others when the main content has them.
 */

const DIR = path.join(process.cwd(), "src/lib/blog/inline-css");

/** Order of the block styles in the live head (consistent over all pages). */
const BLOCK_STYLE_ORDER = [
  "archives",
  "categories",
  "gallery",
  "heading",
  "image",
  "latest-comments",
  "latest-posts",
  "list",
  "paragraph",
  "search",
  "group",
  "quote",
];

/** Blocks of the sidebar (src/components/blog/Sidebar.tsx), present on every page. */
const SIDEBAR_BLOCKS = new Set([
  "archives",
  "categories",
  "heading",
  "latest-comments",
  "latest-posts",
  "search",
  "group",
]);

/** Blocks with an extra line in the global styles (layout gap). */
const GLOBAL_STYLE_BLOCKS = ["gallery", "latest-posts"];

export interface InlineStyle {
  id?: string;
  type?: string;
  css: string;
}

async function read(name: string) {
  return fs.readFile(path.join(DIR, `${name}.css`), "utf-8");
}

function hasBlock(name: string, classes: Set<string>) {
  return SIDEBAR_BLOCKS.has(name) || classes.has(`wp-block-${name}`);
}

/** Styles before the theme stylesheets; `classes` are those of the main content. */
export async function headStyles(classes: Set<string>): Promise<InlineStyle[]> {
  const blocks = BLOCK_STYLE_ORDER.filter((name) => hasBlock(name, classes));
  const global = [
    await read("global-styles"),
    ...(await Promise.all(
      GLOBAL_STYLE_BLOCKS.filter((name) => hasBlock(name, classes)).map((name) =>
        read(`global-styles.${name}`),
      ),
    )),
  ].join("");
  return [
    { id: "wp-img-auto-sizes-contain-inline-css", css: await read("wp-img-auto-sizes-contain") },
    { id: "wp-block-library-inline-css", css: await read("wp-block-library") },
    ...(await Promise.all(
      blocks.map(async (name) => ({
        id: `wp-block-${name}-inline-css`,
        css: await read(`wp-block-${name}`),
      })),
    )),
    { id: "classic-theme-styles-inline-css", css: await read("classic-theme-styles") },
    { id: "global-styles-inline-css", css: global },
  ];
}

/** Styles after the theme stylesheets: Customizer, Fonts Plugin, gallery instances. */
export async function tailStyles(classes: Set<string>): Promise<InlineStyle[]> {
  const galleries = [...classes]
    .map((name) => /^wp-block-gallery-(\d+)$/.exec(name)?.[1])
    .filter((number): number is string => number !== undefined)
    .sort((a, b) => Number(a) - Number(b));
  const gap =
    "var( --wp--style--gallery-gap-default, var( --gallery-block--gutter-size, var( --wp--style--block-gap, 0.5em ) ) )";
  return [
    { type: "text/css", css: await read("customizer") },
    { css: await read("fonts-plugin") },
    ...(galleries.length
      ? [
          {
            id: "core-block-supports-inline-css",
            css: galleries
              .map(
                (number) =>
                  `.wp-block-gallery.wp-block-gallery-${number}{--wp--style--unstable-gallery-gap:${gap};}\n`,
              )
              .join(""),
          },
        ]
      : []),
  ];
}
