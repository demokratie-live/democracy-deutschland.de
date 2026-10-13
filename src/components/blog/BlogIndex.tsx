import { asset } from "@/lib/base-path";
import type { IndexView } from "@/lib/blog/view";
import { PostEntry } from "./PostEntry";

function pageHref(page: number) {
  return asset(page === 1 ? "/blog/" : `/blog/page/${page}/`);
}

/** index.php of Lovecraft: the posts of one page and the page navigation. */
export function BlogIndex({ view }: { view: IndexView }) {
  return (
    <>
      <div className="posts" id="posts">
        {view.posts.map((post) => (
          <PostEntry key={post.post.frontmatter.wpId} view={post} />
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
                <a href={pageHref(view.page - 1)}>Vorheriger</a>
              </p>
            ) : null}{" "}
            {view.page < view.pages ? (
              <p>
                <a href={pageHref(view.page + 1)}>Nächster</a>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
