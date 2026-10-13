/** Fixes of broken WordPress markup, shared by the import and the DOM comparison. */

/**
 * Old newsletters contain image tags pasted from Apple Mail with typographic
 * quotes (`<img id="<democracy_logo>&#8220; class=&#8220;… alt=&#8220;…&#8220;>`).
 * The id value runs to the next ASCII quote and swallows the markup up to
 * there: in most footers a line of text and a link (kept 1:1, decision Manuel
 * 2026-10-13). In News #2 it swallows a </div> and the more span, so on live
 * the sidebar of /blog/page/6/ drops below the posts; a tag that swallows a
 * </div> or the more span is closed at its intended end `&#8220;>` (decision
 * Manuel 2026-10-13, docs/abweichungen.md).
 */
export function closeRunawayImgTags(html: string): string {
  return html.replace(
    /<img id="([^"]*?&#8220;)>([^"]*)"/g,
    (match, value: string, swallowed: string) =>
      /<\/div>|<span id=$/.test(swallowed) ? `<img id="${value}">${swallowed}"` : match,
  );
}
