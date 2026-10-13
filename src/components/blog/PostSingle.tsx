import { asset } from "@/lib/base-path";
import type { PostLink, SingleView } from "@/lib/blog/view";
import { PostMeta } from "./PostMeta";

function NavLink({ className, label, link }: { className: string; label: string; link: PostLink }) {
  return (
    <div className={className}>
      <p>{label}</p>
      <h4>
        <a href={asset(link.permalink)}>{link.title}</a>
      </h4>
    </div>
  );
}

/** single.php of Lovecraft: the post with tags and the links to the neighbouring posts. */
export function PostSingle({ view }: { view: SingleView }) {
  const post = view.post;
  return (
    <article
      id={`post-${post.post.frontmatter.wpId}`}
      className={["post", "single", ...post.classes].join(" ")}
    >
      <div className="post-inner">
        <div className="post-header">
          <h1 className="post-title">
            <a href={asset(post.post.permalink)}>{post.title}</a>
          </h1>
          <PostMeta view={post} />
        </div>
        <div
          className="post-content entry-content"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
        {post.tags.length > 0 ? (
          <div className="post-tags">
            {post.tags.map((tag) => (
              <a key={tag.slug} href={asset(`/blog/tag/${tag.slug}/`)} rel="tag">
                {tag.name}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {view.previous || view.next ? (
        <div className="post-navigation">
          <div className="post-navigation-inner group">
            {view.previous ? (
              <NavLink className="post-nav-prev" label="Vorheriger" link={view.previous} />
            ) : null}
            {view.next ? (
              <NavLink className="post-nav-next" label="Nächster" link={view.next} />
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
