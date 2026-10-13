import { phpRound } from "../donation";
import type { BlogMediaItem } from "../schemas/blog";

export { ImageLoading, lazySizes } from "./image-attributes";

/**
 * Image markup of WordPress 7.1 (PHP 7.4) for the blog: srcset of the featured
 * images and the loading attributes WordPress adds per page.
 */

/** `wp_constrain_dimensions()` */
export function wpConstrainDimensions(
  currentWidth: number,
  currentHeight: number,
  maxWidth = 0,
  maxHeight = 0,
): [number, number] {
  if (!maxWidth && !maxHeight) return [currentWidth, currentHeight];
  let widthRatio = 1;
  let heightRatio = 1;
  let didWidth = false;
  let didHeight = false;
  if (maxWidth > 0 && currentWidth > 0 && currentWidth > maxWidth) {
    widthRatio = maxWidth / currentWidth;
    didWidth = true;
  }
  if (maxHeight > 0 && currentHeight > 0 && currentHeight > maxHeight) {
    heightRatio = maxHeight / currentHeight;
    didHeight = true;
  }
  const smallerRatio = Math.min(widthRatio, heightRatio);
  const largerRatio = Math.max(widthRatio, heightRatio);
  const ratio =
    phpRound(currentWidth * largerRatio) > maxWidth ||
    phpRound(currentHeight * largerRatio) > maxHeight
      ? smallerRatio
      : largerRatio;
  let width = Math.max(1, phpRound(currentWidth * ratio));
  let height = Math.max(1, phpRound(currentHeight * ratio));
  if (didWidth && width === maxWidth - 1) width = maxWidth;
  if (didHeight && height === maxHeight - 1) height = maxHeight;
  return [width, height];
}

/** `wp_image_matches_ratio()`: same aspect ratio within 1 px. */
export function wpImageMatchesRatio(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): boolean {
  const [constrained, expected] =
    sourceWidth > targetWidth
      ? [wpConstrainDimensions(sourceWidth, sourceHeight, targetWidth), [targetWidth, targetHeight]]
      : [
          wpConstrainDimensions(targetWidth, targetHeight, sourceWidth),
          [sourceWidth, sourceHeight],
        ];
  return Math.abs(constrained[0] - expected[0]) <= 1 && Math.abs(constrained[1] - expected[1]) <= 1;
}

const MAX_SRCSET_IMAGE_WIDTH = 2048;

/** Directory of an upload path with trailing slash: /blog/wp-content/uploads/2026/06/ */
function uploadDir(file: string) {
  return file.slice(0, file.lastIndexOf("/") + 1);
}

/**
 * `wp_calculate_image_srcset()` for an image of `size` (width, height) with
 * source `src`: every size of the attachment with the same aspect ratio, the
 * full size included, at most 2048 px wide, the src first; null for fewer
 * than two sources. Keys are widths like the PHP array, so a later size with
 * the same width replaces an earlier one in place.
 */
export function wpCalculateImageSrcset(
  [width, height]: [number, number],
  src: string,
  media: BlogMediaItem,
): string | null {
  const dir = uploadDir(media.file);
  const fullName = media.file.slice(dir.length);
  const candidates = [...media.sizes, { file: fullName, width: media.width, height: media.height }];
  const sources = new Map<number, string>();
  let srcMatched = false;
  for (const image of candidates) {
    let isSrc = false;
    if (
      !srcMatched &&
      src.includes(dir.replace(/^\/blog\/wp-content\/uploads\//, "") + image.file)
    ) {
      srcMatched = true;
      isSrc = true;
    }
    if (image.width > MAX_SRCSET_IMAGE_WIDTH && !isSrc) continue;
    if (!wpImageMatchesRatio(width, height, image.width, image.height)) continue;
    const source = `${(dir + image.file).replace(/ /g, "%20")} ${image.width}w`;
    if (isSrc) {
      // array( $width => $source ) + $sources: the src goes first.
      const rest = [...sources].filter(([key]) => key !== image.width);
      sources.clear();
      sources.set(image.width, source);
      for (const [key, value] of rest) sources.set(key, value);
    } else {
      sources.set(image.width, source);
    }
  }
  if (!srcMatched || sources.size < 2) return null;
  return [...sources.values()].join(", ");
}

export interface AttachmentImage {
  src: string;
  width: number;
  height: number;
  srcSet: string | null;
  /** `wp_calculate_image_sizes()` */
  sizes: string;
}

/** Image sizes Lovecraft registers (`add_image_size()`), width only, height free. */
const THEME_SIZES: Record<string, number> = { "post-image": 900, "post-image-cover": 1280 };

/**
 * `wp_get_attachment_image_src()` + srcset for an image size of the theme
 * (`post-image`, `post-image-cover`). WordPress creates no size wider than
 * the original; then `image_downsize()` takes the original itself.
 */
export function attachmentImage(media: BlogMediaItem, sizeName: string): AttachmentImage {
  let size: { file: string; width: number; height: number } | undefined = media.sizes.find(
    (entry) => entry.name === sizeName,
  );
  if (!size) {
    const maxWidth = THEME_SIZES[sizeName];
    if (!maxWidth || media.width > maxWidth) {
      throw new Error(`Bild ${media.file} hat keine Größe ${sizeName}`);
    }
    size = {
      file: media.file.slice(uploadDir(media.file).length),
      width: media.width,
      height: media.height,
    };
  }
  const src = uploadDir(media.file) + size.file;
  return {
    src,
    width: size.width,
    height: size.height,
    srcSet: wpCalculateImageSrcset([size.width, size.height], src, media),
    sizes: `(max-width: ${size.width}px) 100vw, ${size.width}px`,
  };
}
