import { asset } from "@/lib/base-path";
import type { FeaturedImage } from "@/lib/blog/listing";
import { FeaturedImg } from "./FeaturedImg";

/**
 * The full-width image below the navigation (header.php): on single posts the
 * featured image (`post-image-cover`), otherwise the custom header image.
 */
export function HeaderImage({
  headerImage,
  featured,
}: {
  headerImage: string;
  featured?: FeaturedImage | null;
}) {
  if (featured === null) {
    // _thumbnail_id of a deleted attachment: WordPress leaves the frame empty.
    return (
      <figure className="header-image bg-image" style={{ backgroundImage: "url(  )" }}></figure>
    );
  }
  const src = asset(featured ? featured.src : headerImage);
  return (
    <figure className="header-image bg-image" style={{ backgroundImage: `url( ${src} )` }}>
      {featured ? (
        <FeaturedImg image={featured} size="post-image-cover" />
      ) : (
        <img src={src} alt="" />
      )}
    </figure>
  );
}
