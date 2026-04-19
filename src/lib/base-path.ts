/**
 * Base path for the deployed site.
 *
 * Reads NEXT_PUBLIC_BASE_PATH at build time (inlined into the static export).
 * Default is "" for custom-domain / local-dev use.
 * CI sets NEXT_PUBLIC_BASE_PATH=/democracy-deutschland.de for the GitHub Pages
 * project URL (https://demokratie-live.github.io/democracy-deutschland.de/).
 *
 * Used by next.config.ts for basePath/assetPrefix and by asset() for raw
 * references to files under public/ (e.g. <img>, CSS background-image) that
 * Next.js does not auto-prefix.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix an absolute-path asset (e.g. "/files/images/foo.png") with BASE_PATH. */
export function asset(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}
