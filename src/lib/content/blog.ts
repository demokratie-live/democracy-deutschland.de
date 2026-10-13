import { blogPostFrontmatterSchema, type BlogPostFrontmatter } from "../schemas/blog";
import { loadAllMdx } from "./load-mdx";

export interface BlogPost {
  frontmatter: BlogPostFrontmatter;
  /** Markdown body (empty for the stubs until the blog import). */
  content: string;
  /** WordPress permalink /blog/<year>/<month>/<slug>/. */
  permalink: string;
}

/** Permalink structure of the blog: /%year%/%monthnum%/%postname%/ from `post_date`. */
export function blogPermalink({ date, slug }: Pick<BlogPostFrontmatter, "date" | "slug">) {
  const [year, month] = date.split("-");
  return `/blog/${year}/${month}/${slug}/`;
}

/** All posts of content/blog/, newest first (post_date DESC like WordPress). */
export async function getBlogPosts(): Promise<BlogPost[]> {
  const files = await loadAllMdx("blog", blogPostFrontmatterSchema);
  return files
    .map(({ frontmatter, content }) => ({
      frontmatter,
      content,
      permalink: blogPermalink(frontmatter),
    }))
    .sort(
      (a, b) =>
        b.frontmatter.date.localeCompare(a.frontmatter.date) ||
        b.frontmatter.wpId - a.frontmatter.wpId,
    );
}

/**
 * The newest `limit` posts: `wp_get_recent_posts(numberposts, orderby
 * post_date DESC)` of default_press::wordpress(), used for the blog teasers
 * on /presse/.
 */
export async function getLatestBlogPosts(limit: number): Promise<BlogPost[]> {
  return (await getBlogPosts()).slice(0, limit);
}
