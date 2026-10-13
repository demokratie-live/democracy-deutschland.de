import { Fragment } from "react";
import { asset } from "@/lib/base-path";
import type { PostView } from "@/lib/blog/view";

/**
 * lovecraft_meta(): author, date and categories of a post. The paragraphs are
 * inline blocks; the whitespace between them comes from the template.
 */
export function PostMeta({ view }: { view: PostView }) {
  return (
    <div className="post-meta">
      <p className="post-author">
        <span>Von </span>
        <a href={asset(`/blog/author/${view.author.slug}/`)} rel="author">
          {view.author.name}
        </a>
      </p>{" "}
      <p className="post-date">
        <span>Am </span>
        <a href={asset(view.post.permalink)}>{view.date}</a>
      </p>{" "}
      <p className="post-categories">
        <span>In </span>
        {view.categories.map((category, index) => (
          <Fragment key={category.slug}>
            {index > 0 ? ", " : null}
            <a href={asset(`/blog/category/${category.slug}/`)} rel="category tag">
              {category.name}
            </a>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
