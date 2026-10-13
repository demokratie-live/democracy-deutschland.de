import { asset } from "@/lib/base-path";
import type { PostView } from "@/lib/blog/listing";
import { FeaturedImg } from "./FeaturedImg";
import { PostMeta } from "./PostMeta";

/** content.php of Lovecraft in the post list: image, title, meta, teaser with "Weiterlesen". */
export function PostEntry({ view }: { view: PostView }) {
  const permalink = asset(view.permalink);
  return (
    <div id={`post-${view.wpId}`} className={["post", ...view.classes].join(" ")}>
      {view.featured !== undefined ? (
        <figure className="post-image">
          <a href={permalink}>
            {view.featured ? <FeaturedImg image={view.featured} size="post-image" /> : null}
          </a>
        </figure>
      ) : null}
      <div className="post-inner">
        <div className="post-header">
          <h2 className="post-title">
            <a href={permalink}>{view.title}</a>
          </h2>
          <PostMeta view={view} />
        </div>
        <div
          className="post-content entry-content"
          dangerouslySetInnerHTML={{ __html: view.html }}
        />
      </div>
    </div>
  );
}
