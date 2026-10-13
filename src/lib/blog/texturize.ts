/**
 * wptexturize() for post titles: WordPress stores the raw `post_title` ("'25",
 * " - ") and shows it typographically ("’25", " – ") in the blog, the press
 * teasers show it raw. Works on decoded text.
 *
 * Only the rules the imported titles need are ported; `pnpm import-blog`
 * checks for every post that wptexturize(title) equals the title WordPress
 * renders and stops on a mismatch, so a new pattern shows up there.
 */
export function wptexturize(text: string): string {
  return (
    text
      // Static replacements in WordPress order.
      .replace(/---/g, "—")
      .replace(/ -- /g, " — ")
      .replace(/--/g, "–")
      .replace(/ - /g, " – ")
      .replace(/\.\.\./g, "…")
      // Apostrophe before a decade ('25) and between word characters (Ihr's, DEMOCRACY'21).
      .replace(/'(?=\d\d(?!\d))/g, "’")
      .replace(/(?<=[\p{L}\p{N}])'(?=[\p{L}\p{N}])/gu, "’")
  );
}
