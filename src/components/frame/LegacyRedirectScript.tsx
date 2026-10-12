import { BASE_PATH } from "@/lib/base-path";
import { resolveLegacyUrl, toLegacyRouteMap } from "@/lib/legacy-redirect";
import type { Routes } from "@/lib/schemas";

/**
 * Inline script at the top of <head>: forwards old links (#!<state>,
 * ?page=<state>, aliases) before anything renders.
 */
export function LegacyRedirectScript({ routes }: { routes: Routes }) {
  const map = JSON.stringify(toLegacyRouteMap(routes));
  const code =
    `(function(){try{var t=(${resolveLegacyUrl.toString()})` +
    `(location.href,${map},${JSON.stringify(BASE_PATH)});` +
    `if(t&&t!==location.href)location.replace(t)}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
