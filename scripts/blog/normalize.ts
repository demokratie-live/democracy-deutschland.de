/**
 * Canonical text form of a DOM tree (hast) for comparing WordPress output with
 * the port: equal forms render the same.
 *
 * - comments, <script> and <style> are dropped
 * - whitespace collapses like CSS `white-space: normal`: runs become one
 *   space, spaces at the start and end of a line (block boundaries, <br>) and
 *   after another space (also across inline elements) disappear; NBSP stays
 * - attributes are sorted; `mapUrl` can rewrite URLs (href, src, srcset,
 *   action, style) and `mapAttribute` any other value
 */
import type { Element, ElementContent, Root, RootContent, Text } from "hast";

/** Elements that start a new line (block or list boxes in the theme). */
const BLOCK = new Set(
  "address article aside blockquote body center dd details dialog dir div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hr html li main menu nav ol p pre section summary table tbody td tfoot th thead tr ul".split(
    " ",
  ),
);
const DROP = new Set(["script", "style", "noscript", "template"]);
/** Atomic inline content: a space before or after it stays. */
const REPLACED = new Set(
  "img input button select textarea iframe video audio svg object embed canvas".split(" "),
);
const URL_ATTRIBUTES = new Set(["href", "src", "action", "poster"]);

export interface NormalizeOptions {
  mapUrl?: (url: string) => string;
  mapAttribute?: (name: string, value: string, element: Element) => string;
}

type Node = Root | RootContent | ElementContent;

function cloneWithoutDropped(node: Node): Node | null {
  if (node.type === "comment" || node.type === "doctype") return null;
  if (node.type === "element") {
    if (DROP.has(node.tagName)) return null;
    const children = (node.tagName === "template" ? [] : node.children)
      .map(cloneWithoutDropped)
      .filter((child): child is ElementContent => child !== null);
    return { ...node, properties: { ...node.properties }, children };
  }
  if (node.type === "root") {
    const children = node.children
      .map(cloneWithoutDropped)
      .filter((child): child is RootContent => child !== null);
    return { ...node, children };
  }
  if (node.type === "text") return { ...node };
  return null;
}

/** CSS whitespace processing over the inline content of every block. */
function collapseWhitespace(root: Node) {
  let lastText: Text | null = null;
  let atLineStart = true;

  const breakLine = () => {
    if (lastText) lastText.value = lastText.value.replace(/ $/, "");
    lastText = null;
    atLineStart = true;
  };

  const walk = (node: Node) => {
    if (node.type === "text") {
      let value = node.value.replace(/[ \t\n\r\f]+/g, " ");
      if (atLineStart) value = value.replace(/^ /, "");
      node.value = value;
      if (value) {
        lastText = node;
        atLineStart = value.endsWith(" ");
      }
      return;
    }
    if (node.type !== "element" && node.type !== "root") return;
    const block = node.type === "root" || BLOCK.has(node.tagName);
    if (node.type === "element" && node.tagName === "br") {
      breakLine();
      return;
    }
    if (block) breakLine();
    if (node.type === "element" && REPLACED.has(node.tagName) && !block) {
      lastText = null;
      atLineStart = false;
    }
    for (const child of node.children) walk(child);
    if (block) breakLine();
  };
  walk(root);
}

function removeEmptyText(node: Node) {
  if (node.type !== "element" && node.type !== "root") return;
  node.children = node.children.filter(
    (child) => child.type !== "text" || child.value !== "",
  ) as typeof node.children;
  for (const child of node.children) removeEmptyText(child);
}

function attributeValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(" ");
  if (value === true) return "";
  return String(value);
}

/** hast property name → HTML attribute name for the common cases. */
function attributeName(name: string): string {
  const special: Record<string, string> = {
    className: "class",
    htmlFor: "for",
    srcSet: "srcset",
    fetchPriority: "fetchpriority",
    httpEquiv: "http-equiv",
    acceptCharset: "accept-charset",
    ariaLabel: "aria-label",
    ariaHidden: "aria-hidden",
  };
  if (special[name]) return special[name];
  if (name.startsWith("data")) return name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  return name.toLowerCase();
}

function serialize(node: Node, options: NormalizeOptions, depth: number, out: string[]) {
  const indent = "  ".repeat(depth);
  if (node.type === "text") {
    out.push(`${indent}${JSON.stringify(node.value)}`);
    return;
  }
  if (node.type === "root") {
    for (const child of node.children) serialize(child, options, depth, out);
    return;
  }
  if (node.type !== "element") return;
  const attributes = Object.entries(node.properties)
    .filter(([, value]) => value !== false && value !== null && value !== undefined)
    .map(([key, value]) => {
      const name = attributeName(key);
      let text = attributeValue(value);
      if (name === "class") text = text.trim().split(/\s+/).join(" ");
      if (options.mapUrl) {
        if (URL_ATTRIBUTES.has(name)) text = options.mapUrl(text);
        if (name === "srcset") {
          text = text
            .split(/,\s*/)
            .map((entry) => {
              const [url, ...rest] = entry.trim().split(/\s+/);
              return [options.mapUrl!(url), ...rest].join(" ");
            })
            .join(", ");
        }
        if (name === "style") {
          text = text.replace(/url\(\s*([^)]*?)\s*\)/g, (_, url) => `url(${options.mapUrl!(url)})`);
        }
      }
      if (options.mapAttribute) text = options.mapAttribute(name, text, node);
      return `${name}=${JSON.stringify(text)}`;
    })
    .sort();
  const open = [node.tagName, ...attributes].join(" ");
  if (node.children.length === 0) {
    out.push(`${indent}<${open}/>`);
    return;
  }
  out.push(`${indent}<${open}>`);
  for (const child of node.children) serialize(child, options, depth + 1, out);
  out.push(`${indent}</${node.tagName}>`);
}

/** Canonical form of the given nodes (siblings in one block context). */
export function normalizeNodes(
  nodes: Array<RootContent | ElementContent>,
  options: NormalizeOptions = {},
): string {
  const root = cloneWithoutDropped({ type: "root", children: nodes as RootContent[] }) as Root;
  collapseWhitespace(root);
  removeEmptyText(root);
  const out: string[] = [];
  serialize(root, options, 0, out);
  return out.join("\n");
}
