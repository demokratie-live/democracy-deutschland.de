import { legacyPathRules, toLegacyPathEntries, type LegacyPathEntry } from "./legacy-paths";
import type { AppLinks, Routes } from "./schemas";

/** Compact form of content/site/routes.yaml and legacy-paths.ts that is inlined into every page. */
export interface LegacyRouteMap {
  /** Path of the start state; unknown states land here like on live. */
  start: string;
  /** state -> path */
  states: Record<string, string>;
  /** path -> path */
  aliases: Record<string, string>;
  /** Old paths outside the hash router (src/lib/legacy-paths.ts). */
  paths: LegacyPathEntry[];
}

export function toLegacyRouteMap(
  routes: Routes,
  appLinks: Pick<AppLinks, "apk" | "aab">,
): LegacyRouteMap {
  const states: Record<string, string> = {};
  for (const route of routes.routes) states[route.state] = route.path;
  const aliases: Record<string, string> = {};
  for (const alias of routes.aliases) aliases[alias.from] = alias.to;
  return {
    start: states[routes.start] ?? "/",
    states,
    aliases,
    paths: toLegacyPathEntries(legacyPathRules(appLinks)),
  };
}

/**
 * Translate an old URL of the PHP site into the new one, or return null when
 * nothing has to change. Handles
 *   /#!<state>, /#!<state>#<anchor>   (hash router, see lib/system/.../system.js)
 *   /#!<state>;<key>.<value>          (state variables of State::get(), e.g. the
 *                                      unsubscribe links of old newsletter mails)
 *   /?page=<state>&…                  (server-side page parameter)
 *   /?_escaped_fragment_=<state>      (crawler URLs)
 *   /%23!<state>                      (encoded hash of old app links)
 *   aliases such as /democracy/ and the old paths of legacy-paths.ts
 *
 * The function is serialised with `toString()` into an inline <script> (see
 * LegacyRedirectScript), so it must not reference anything outside its body.
 */
export function resolveLegacyUrl(
  href: string,
  map: LegacyRouteMap,
  basePath: string,
): string | null {
  // No inner functions or callbacks: compilers wrap them in helpers (e.g.
  // esbuild's __name) that do not exist inside the inline script.
  const url = new URL(href);
  let rel = url.pathname;
  let rawHash = url.hash;
  if (basePath && rel.indexOf(basePath) === 0) rel = rel.slice(basePath.length) || "/";
  // /%23!<state>: the old .htaccess redirected to /#!<state> (democracy-client#1142);
  // the fragment of that redirect replaces one the old URL had.
  const encoded = rel.indexOf("%23!");
  if (encoded >= 0) {
    rawHash = "#" + rel.slice(encoded + 3);
    rel = rel.slice(0, encoded) || "/";
  }
  let path = rel;
  if (path.charAt(path.length - 1) !== "/") path += "/";

  let state: string | null = null;
  let search = url.search;
  let hash = rawHash;

  if (rawHash.indexOf("#!") === 0) {
    // #!<state> or #!<state>#<anchor>: like system.js, the last "#" part is
    // the anchor and the part before it the state.
    const parts = rawHash.slice(2).split("#");
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
    // <state>(<substates>);<key>.<value>;… like State::get(): the variables
    // filled the module URL (./?page=unsubscribe&token=${token}), here they
    // become query parameters in front of the others.
    const vars = state.split(";");
    let query = "";
    for (let i = 1; i < vars.length; i++) {
      if (!vars[i]) continue;
      const dot = vars[i].indexOf(".");
      query +=
        (query ? "&" : "") +
        (dot < 0 ? vars[i] + "=" : vars[i].slice(0, dot) + "=" + vars[i].slice(dot + 1));
    }
    if (query) search = "?" + query + (search ? "&" + search.slice(1) : "");
    state = vars[0].split("(")[0];
    target = Object.prototype.hasOwnProperty.call(map.states, state)
      ? map.states[state]
      : map.start;
  } else if (Object.prototype.hasOwnProperty.call(map.aliases, path)) {
    target = map.aliases[path];
  } else {
    let rule: LegacyPathEntry | null = null;
    let match: RegExpExecArray | null = null;
    for (let i = 0; i < map.paths.length && !match; i++) {
      rule = map.paths[i];
      match = new RegExp("^(?:" + rule.from + ")$", rule.i ? "i" : "").exec(rel.slice(1));
    }
    if (!rule || !match) return null;
    let to = rule.to;
    for (let group = match.length - 1; group > 0; group--) {
      to = to.split("$" + group).join(match[group] || "");
    }
    if (rule.q) search = "";
    else if (search && to.indexOf("?") >= 0) search = "&" + search.slice(1);
    if (/^https?:/.test(to)) return to + search + hash;
    target = to;
  }
  const result = url.origin + basePath + target + search + hash;
  // A rule may match its own target (/wahlometer/ for the spellings rule).
  return result === href ? null : result;
}
