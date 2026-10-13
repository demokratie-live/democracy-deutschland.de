import { asset } from "@/lib/base-path";
import { mapSrcSet } from "@/lib/blog/markdown";
import type { FeaturedImage } from "@/lib/blog/view";

/** `the_post_thumbnail( $size )`: <img> with srcset and the loading attributes of the page. */
export function FeaturedImg({ image, size }: { image: FeaturedImage; size: string }) {
  return (
    <img
      width={image.width}
      height={image.height}
      src={asset(image.src)}
      className={`attachment-${size} size-${size} wp-post-image`}
      alt=""
      decoding="async"
      fetchPriority={image.fetchPriority}
      loading={image.loading}
      srcSet={image.srcSet ? mapSrcSet(image.srcSet, asset) : undefined}
      sizes={image.srcSet ? image.sizes : undefined}
    />
  );
}
