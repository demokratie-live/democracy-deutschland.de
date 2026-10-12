import type { Routes } from "./schemas";

/** Compact form of content/site/routes.yaml that is inlined into every page. */
export interface LegacyRouteMap {
  /** Path of the start state; unknown states land here like on live. */
  start: string;
  /** state -> path */
  states: Record<string, string>;
  /** path -> path */
  aliases: Record<string, string>;
}

export function toLegacyRouteMap(routes: Routes): LegacyRouteMap {
  const states: Record<string, string> = {};
  for (const route of routes.routes) states[route.state] = route.path;
  const aliases: Record<string, string> = {};
  for (const alias of routes.aliases) aliases[alias.from] = alias.to;
  return { start: states[routes.start] ?? "/", states, aliases };
}

/**
 * Translate an old URL of the PHP site into the new path, or return null when
 * nothing has to change. Handles
 *   /#!<state>, /#!<state>#<anchor>   (hash router, see lib/system/.../system.js)
 *   /?page=<state>&…                  (server-side page parameter)
 *   /?_escaped_fragment_=<state>      (crawler URLs)
 *   aliases such as /democracy/
 *
 * The function is serialised with `toString()` into an inline <script> (see
 * LegacyRedirectScript), so it must not reference anything outside its body.
 */
export function resolveLegacyUrl(
  href: string,
  map: LegacyRouteMap,
  basePath: string,
): string | null {
  // No inner functions: compilers wrap them in helpers (e.g. esbuild's
  // __name) that do not exist inside the inline script.
  const url = new URL(href);
  let path = url.pathname;
  if (basePath && path.indexOf(basePath) === 0) path = path.slice(basePath.length) || "/";
  if (path.charAt(path.length - 1) !== "/") path += "/";

  let state: string | null = null;
  let search = url.search;
  let hash = url.hash;

  if (url.hash.indexOf("#!") === 0) {
    // #!<state> or #!<state>#<anchor>: like system.js, the last "#" part is
    // the anchor and the part before it the state.
    const parts = url.hash.slice(2).split("#");
    const anchor = parts.length > 1 ? parts.pop() : "";
    state = parts.pop() || "";
    hash = anchor ? "#" + anchor : "";
  } else {
    const params = url.searchParams;
    const key = params.has("page")
      ? "page"
      : params.has("_escaped_fragment_")
        ? "_escaped_fragment_"
        : "";
    if (key) {
      state = params.get(key) || "";
      params.delete(key);
      const rest = params.toString();
      search = rest ? "?" + rest : "";
    }
  }

  let target: string;
  if (state !== null) {
    target = Object.prototype.hasOwnProperty.call(map.states, state)
      ? map.states[state]
      : map.start;
  } else if (Object.prototype.hasOwnProperty.call(map.aliases, path)) {
    target = map.aliases[path];
  } else {
    return null;
  }
  return url.origin + basePath + target + search + hash;
}
