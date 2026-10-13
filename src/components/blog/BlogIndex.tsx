import { asset } from "@/lib/base-path";
import { pageHref, type ListingView } from "@/lib/blog/listing";
import { PostEntry } from "./PostEntry";

/**
 * index.php of Lovecraft for post lists (blog home, archives, search): the
 * archive header, the posts of one page and the page navigation.
 */
export function BlogIndex({ view }: { view: ListingView }) {
  const href = (page: number) => asset(pageHref(view.base, page, view.query));
  return (
    <>
      {view.heading ? (
        <div className="archive-header">
          <h1 className="archive-title">
            {view.heading.text}
            {view.heading.name ? (
              <>
                {" "}
                <span>{view.heading.name}</span>
              </>
            ) : null}
            {/* Lovecraft prints the page count only while a next page follows. */}
            {view.page < view.pages ? (
              <>
                {" "}
                <span>
                  Seite {view.page} von {view.pages}
                </span>
              </>
            ) : null}
          </h1>
        </div>
      ) : null}
      <div className="posts" id="posts">
        {view.posts.map((post) => (
          <PostEntry key={post.wpId} view={post} />
        ))}
      </div>
      {view.pages > 1 ? (
        <div className="archive-navigation group">
          <div className="fleft">
            <p>
              Seite {view.page} von {view.pages}
            </p>
          </div>
          <div className="fright">
            {view.page > 1 ? (
              <p>
                <a href={href(view.page - 1)}>Vorheriger</a>
              </p>
            ) : null}{" "}
            {view.page < view.pages ? (
              <p>
                <a href={href(view.page + 1)}>Nächster</a>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
