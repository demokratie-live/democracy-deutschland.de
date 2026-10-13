/**
 * WordPress post HTML → Markdown with inline HTML, without changing the DOM.
 *
 * Every top-level block becomes Markdown when it is a plain paragraph,
 * heading or list of the block editor (classes `wp-block-paragraph`,
 * `wp-block-heading`, `wp-block-list`, added back by the render pipeline);
 * everything else stays HTML. Inside Markdown, elements Markdown cannot
 * express (<b>, links with target …) stay inline HTML around Markdown
 * children. Each block is rendered back with the blog pipeline and compared
 * with the original (scripts/blog/normalize.ts); on a difference the block
 * falls back to HTML, and the whole post is checked once more at the end.
 */
import type { Element, ElementContent, Root, RootContent } from "hast";
import { toHtml } from "hast-util-to-html";
import type { Nodes as MdNodes, PhrasingContent } from "mdast";
import { createTwoFilesPatch } from "diff";
import { toMarkdown } from "mdast-util-to-markdown";
import { markdownToHast } from "../../src/lib/blog/markdown";
import { normalizeNodes } from "./normalize";

/** Tags that start a CommonMark HTML block of type 6. */
const HTML_BLOCK_TAGS = new Set(
  "address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul".split(
    " ",
  ),
);
const VOID = new Set("area base br col embed hr img input link meta source track wbr".split(" "));
const HEADINGS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

/** Invisible characters are written as references to keep them visible in the file. */
const INVISIBLE = /[\u00a0\u00ad\u200b-\u200f\u2028\u2029\ufeff]/g;

function encodeInvisible(markdown: string) {
  return markdown.replace(INVISIBLE, (char) =>
    char === "\u00a0" ? "&nbsp;" : `&#x${char.charCodeAt(0).toString(16)};`,
  );
}

function isWhitespace(node: RootContent | ElementContent) {
  return node.type === "text" && /^[ \t\n\r\f]*$/.test(node.value);
}

function onlyClass(element: Element, className: string) {
  const keys = Object.keys(element.properties);
  const classes = element.properties.className as string[] | undefined;
  return (
    keys.length === 1 &&
    keys[0] === "className" &&
    classes?.length === 1 &&
    classes[0] === className
  );
}

function hasNoProperties(element: Element) {
  return Object.keys(element.properties).length === 0;
}

function textContent(nodes: ElementContent[]): string {
  return nodes
    .map((node) =>
      node.type === "text" ? node.value : node.type === "element" ? textContent(node.children) : "",
    )
    .join("");
}

/** Opening and closing tag of an element as written by hast-util-to-html. */
function tags(element: Element): [string, string] {
  const html = toHtml({ ...element, children: [] });
  if (VOID.has(element.tagName)) return [html, ""];
  const close = `</${element.tagName}>`;
  return [html.slice(0, -close.length), close];
}

function html(value: string): PhrasingContent {
  return { type: "html", value };
}

/** Phrasing content as mdast, raw HTML around what Markdown cannot express. */
function phrasing(nodes: ElementContent[]): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      out.push({ type: "text", value: node.value.replace(/[ \t\n\r\f]+/g, " ") });
    } else if (node.type === "comment") {
      out.push(html(`<!--${node.value}-->`));
    } else if (node.type === "element") {
      out.push(...phrasingElement(node));
    }
  }
  return out;
}

function phrasingElement(element: Element): PhrasingContent[] {
  const { tagName } = element;
  if (tagName === "br" && hasNoProperties(element)) return [{ type: "break" }];
  const text = textContent(element.children);
  const markdownAttention =
    (tagName === "strong" || tagName === "em") &&
    hasNoProperties(element) &&
    text.trim() !== "" &&
    text === text.trim();
  if (markdownAttention) {
    return [
      {
        type: tagName === "strong" ? "strong" : "emphasis",
        children: phrasing(element.children),
      },
    ];
  }
  const keys = Object.keys(element.properties);
  if (tagName === "a" && keys.length === 1 && keys[0] === "href" && text.trim() !== "") {
    return [
      { type: "link", url: String(element.properties.href), children: phrasing(element.children) },
    ];
  }
  const [open, close] = tags(element);
  if (VOID.has(tagName)) return [html(open)];
  return [html(open), ...phrasing(element.children), html(close)];
}

/**
 * Spaces at the start and end of a line do not render (CSS white-space:
 * normal): drop them at the block edges and around hard breaks instead of
 * writing them as `&#x20;`.
 */
function trimLines(children: PhrasingContent[]): PhrasingContent[] {
  const out = children.map((child) => (child.type === "text" ? { ...child } : child));
  out.forEach((child, index) => {
    if (child.type !== "text") return;
    const previous = out[index - 1];
    const next = out[index + 1];
    if (!previous || previous.type === "break") child.value = child.value.replace(/^ +/, "");
    if (!next || next.type === "break") child.value = child.value.replace(/ +$/, "");
  });
  return out.filter((child) => child.type !== "text" || child.value !== "");
}

/** Markdown for a block, or null when Markdown cannot express it. */
function blockToMdast(element: Element): MdNodes | null {
  const content = element.children.filter((child) => !isWhitespace(child));
  if (element.tagName === "p" && onlyClass(element, "wp-block-paragraph")) {
    if (content.length === 0) return null;
    return { type: "paragraph", children: trimLines(phrasing(element.children)) };
  }
  const depth = HEADINGS[element.tagName];
  if (depth && onlyClass(element, "wp-block-heading")) {
    if (content.length === 0) return null;
    return { type: "heading", depth, children: trimLines(phrasing(element.children)) };
  }
  if (
    (element.tagName === "ul" || element.tagName === "ol") &&
    onlyClass(element, "wp-block-list")
  ) {
    const items = content as Element[];
    const simple = items.every(
      (item) =>
        item.type === "element" &&
        item.tagName === "li" &&
        hasNoProperties(item) &&
        item.children.every(
          (child) =>
            child.type !== "element" ||
            !["ul", "ol", "p", "div", "figure", "blockquote"].includes(child.tagName),
        ),
    );
    if (!simple || items.length === 0) return null;
    return {
      type: "list",
      ordered: element.tagName === "ol",
      start: element.tagName === "ol" ? 1 : undefined,
      spread: false,
      children: items.map((item) => ({
        type: "listItem",
        spread: false,
        children: [{ type: "paragraph", children: trimLines(phrasing(item.children)) }],
      })),
    };
  }
  return null;
}

function serializeMarkdown(node: MdNodes): string {
  const markdown = toMarkdown(node, {
    bullet: "-",
    emphasis: "*",
    strong: "*",
    listItemIndent: "one",
  });
  return encodeInvisible(markdown.trimEnd());
}

/** The element as one CommonMark HTML block (no blank lines inside). */
function htmlBlock(element: Element): string {
  const clone = structuredClone(element);
  const squeeze = (node: ElementContent) => {
    if (node.type === "text") {
      node.value = node.value.replace(/[ \t\r\f]*\n[ \t\r\n\f]*\n[ \t\r\n\f]*/g, "\n");
    } else if (node.type === "element" && !["pre", "textarea"].includes(node.tagName)) {
      node.children.forEach(squeeze);
    }
  };
  squeeze(clone);
  const value = encodeInvisible(toHtml(clone));
  const blank = /\n[ \t]*\n/.exec(value);
  if (blank) {
    const around = value.slice(Math.max(0, blank.index - 150), blank.index + 50);
    throw new Error(`HTML-Block enthält eine Leerzeile (z. B. in einem Attribut): …${around}…`);
  }
  if (!HTML_BLOCK_TAGS.has(element.tagName)) {
    throw new Error(
      `<${element.tagName}> auf oberster Ebene ist kein HTML-Block: ${value.slice(0, 200)}`,
    );
  }
  return value;
}

function sameDom(markdown: string, original: Array<RootContent | ElementContent>) {
  const rendered = markdownToHast(markdown).children;
  return normalizeNodes(rendered) === normalizeNodes(original);
}

/** Readable difference for error messages. */
function domDiff(markdown: string, original: Array<RootContent | ElementContent>) {
  const patch = createTwoFilesPatch(
    "original",
    "markdown",
    normalizeNodes(original),
    normalizeNodes(markdownToHast(markdown).children),
    undefined,
    undefined,
    { context: 1 },
  );
  return patch
    .split("\n")
    .slice(4, 24)
    .map((line) => line.slice(0, 200))
    .join("\n");
}

export interface ConversionStats {
  markdown: number;
  html: number;
}

/**
 * Post HTML (the content of `.post-content`, already prepared by the import:
 * `<!--more-->` comment, local upload paths) → Markdown body.
 */
export function htmlToMarkdown(fragment: Root, stats?: ConversionStats): string {
  const blocks: string[] = [];
  for (const node of fragment.children) {
    if (isWhitespace(node)) continue;
    if (node.type === "comment") {
      blocks.push(`<!--${node.value}-->`);
      continue;
    }
    if (node.type !== "element") {
      throw new Error(
        `Unerwarteter Knoten auf oberster Ebene: ${node.type} ${JSON.stringify(node).slice(0, 120)}`,
      );
    }
    const mdast = blockToMdast(node);
    const markdown = mdast ? serializeMarkdown(mdast) : null;
    if (markdown !== null && sameDom(markdown, [node])) {
      blocks.push(markdown);
      if (stats) stats.markdown++;
      continue;
    }
    const block = htmlBlock(node);
    if (!sameDom(block, [node])) {
      throw new Error(`HTML-Block weicht nach dem Rendern ab:\n${domDiff(block, [node])}`);
    }
    blocks.push(block);
    if (stats) stats.html++;
  }
  const markdown = `${blocks.join("\n\n")}\n`;
  if (!sameDom(markdown, fragment.children)) {
    throw new Error(
      `Markdown weicht nach dem Rendern vom Original ab (Zusammenspiel der Blöcke):\n${domDiff(markdown, fragment.children)}`,
    );
  }
  return markdown;
}
