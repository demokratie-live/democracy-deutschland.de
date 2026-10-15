/**
 * Image attributes WordPress adds when it renders a page. Plain functions
 * without Node or Markdown dependencies: the server uses them while
 * rendering, the client search (src/components/blog/BlogSearch.tsx) for its
 * result pages.
 */

/**
 * Loading attributes WordPress adds to the images of a page
 * (`wp_get_loading_optimization_attributes()`): counted are images with width
 * and height in page order (featured images and content images); the first
 * large one gets fetchpriority="high", the first three stay eager, every later
 * one gets loading="lazy" and "auto, " in front of its sizes.
 */
export class ImageLoading {
  private count = 0;
  private priority = false;

  next(width: number | undefined, height: number | undefined) {
    if (!width || !height) return {};
    const index = this.count++;
    if (!this.priority && width * height >= 50_000) {
      this.priority = true;
      return { fetchPriority: "high" as const };
    }
    return index >= 3 ? { loading: "lazy" as const } : {};
  }
}

/** sizes attribute of a lazy image: WordPress 6.7 prepends "auto, ". */
export function lazySizes(sizes: string, loading: string | undefined) {
  return loading === "lazy" ? `auto, ${sizes}` : sizes;
}

/** Applies `map` to every URL of a srcset (hast keeps it as a string or list). */
export function mapSrcSet(value: unknown, map: (url: string) => string): string {
  const entries = Array.isArray(value) ? value.map(String) : String(value).split(",");
  return entries
    .map((entry) => {
      const [url, ...descriptor] = entry.trim().split(/\s+/);
      return [map(url), ...descriptor].join(" ");
    })
    .join(", ");
}

/**
 * The loading attributes for the `<img>` tags of rendered content (HTML of
 * `renderPostContent()` without them), in document order: the same result as
 * rendering with `loading`, as a string operation for the client.
 */
export function applyImageLoading(html: string, loading: ImageLoading): string {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const number = (name: string) => Number(new RegExp(`\\s${name}="(\\d+)"`).exec(tag)?.[1]) || 0;
    const attrs = loading.next(number("width"), number("height"));
    let result = tag;
    if (attrs.loading) result = result.replace(/(\ssizes=")/, "$1auto, ");
    const extra = attrs.fetchPriority
      ? ` fetchpriority="${attrs.fetchPriority}"`
      : attrs.loading
        ? ` loading="${attrs.loading}"`
        : "";
    return result.replace(/\s*\/?>$/, (end) => `${extra}${end}`);
  });
}
