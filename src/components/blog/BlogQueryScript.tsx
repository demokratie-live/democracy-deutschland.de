import { BASE_PATH } from "@/lib/base-path";
import { SEARCH_PENDING_SHEET } from "@/lib/blog/search";
import { resolveBlogShortlink } from "@/lib/blog/shortlink";

/**
 * Inline script in <head> of the blog index pages, for the query strings
 * WordPress answers on the server: `?p=<id>` (with `permalinks`, on /blog/)
 * forwards to the permalink before anything renders; with `?s=` a
 * constructed style sheet hides the content column until BlogSearch shows
 * the results (without such sheets the post list shows briefly).
 */
export function BlogQueryScript({ permalinks }: { permalinks?: Record<string, string> }) {
  const shortlink = permalinks
    ? `var r=${resolveBlogShortlink.toString()};` +
      `try{var t=r(location.href,${JSON.stringify(permalinks)},${JSON.stringify(BASE_PATH)});` +
      `if(t){location.replace(t);return}}catch(e){}`
    : "";
  const code =
    `(function(){${shortlink}` +
    `if(/[?&]s(=|&|$)/.test(location.search)&&"adoptedStyleSheets"in document){try{` +
    `var c=new CSSStyleSheet();c.replaceSync("#site-content .content{visibility:hidden}");` +
    `document.adoptedStyleSheets=document.adoptedStyleSheets.concat(c);` +
    `window[${JSON.stringify(SEARCH_PENDING_SHEET)}]=c}catch(e){}}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
