/**
 * WordPress short links /blog/?p=<id> and /blog/?post_type=post&p=<id>:
 * WordPress answers with 301 to the permalink, an unknown id with 404.
 *
 * The function is serialised with `toString()` into an inline <script>
 * (BlogQueryScript), so it must not reference anything outside its body and
 * must not contain inner functions (see resolveLegacyUrl).
 */
export function resolveBlogShortlink(
  href: string,
  /** wpId → permalink (/blog/<year>/<month>/<slug>/) */
  permalinks: Record<string, string>,
  basePath: string,
): string | null {
  const url = new URL(href);
  const id = url.searchParams.get("p");
  if (id === null || !/^[0-9]+$/.test(id) || Number(id) === 0) return null;
  const postType = url.searchParams.get("post_type");
  url.searchParams.delete("p");
  url.searchParams.delete("post_type");
  const known = Object.prototype.hasOwnProperty.call(permalinks, id);
  // Only posts are known; other post types and unknown ids are a 404 in WordPress.
  const target = known && (postType === null || postType === "post") ? permalinks[id] : "/404/";
  const rest = url.searchParams.toString();
  return url.origin + basePath + target + (rest ? "?" + rest : "") + url.hash;
}
