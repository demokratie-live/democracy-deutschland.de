import { BASE_PATH } from "@/lib/base-path";
import { resolveLegacyUrl, toLegacyRouteMap } from "@/lib/legacy-redirect";
import type { AppLinks, Routes } from "@/lib/schemas";

/**
 * Inline script in <head>: forwards old links (#!<state>, ?page=<state>,
 * aliases, old paths of src/lib/legacy-paths.ts) before anything renders, and
 * on later hash changes to #!<state> (the old hash router listened to
 * hashchange as well). On the 404 page it forwards old paths that do not
 * exist as files on hosts without .htaccess.
 */
export function LegacyRedirectScript({ routes, appLinks }: { routes: Routes; appLinks: AppLinks }) {
  const map = JSON.stringify(toLegacyRouteMap(routes, appLinks));
  const code =
    `(function(){var r=${resolveLegacyUrl.toString()};` +
    `function go(){try{var t=r(location.href,${map},${JSON.stringify(BASE_PATH)});` +
    `if(t&&t!==location.href)location.replace(t)}catch(e){}}` +
    `go();window.addEventListener("hashchange",go);})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
