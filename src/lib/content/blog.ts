import {
  blogMediaSchema,
  blogPostFrontmatterSchema,
  blogSiteSchema,
  blogTaxonomySchema,
  type BlogMediaItem,
  type BlogPostFrontmatter,
  type BlogTerm,
} from "../schemas/blog";
import { loadAllMdx } from "./load-mdx";
import { loadYaml } from "./load-yaml";

export interface BlogPost {
  frontmatter: BlogPostFrontmatter;
  /** Post content: Markdown with inline HTML (src/lib/blog/markdown.ts renders it). */
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
 * on /presse/, and the widget "Neueste Beiträge".
 */
export async function getLatestBlogPosts(limit: number): Promise<BlogPost[]> {
  return (await getBlogPosts()).slice(0, limit);
}

/** content/blog/site.yaml */
export function getBlogSite() {
  return loadYaml("blog/site.yaml", blogSiteSchema);
}

export interface BlogTaxonomyIndex {
  author(slug: string): BlogTerm;
  category(slug: string): BlogTerm;
  tag(slug: string): BlogTerm;
  authors: BlogTerm[];
  categories: BlogTerm[];
  tags: BlogTerm[];
}

/** content/blog/taxonomy.yaml with lookups by slug (throws for unknown slugs). */
export async function getBlogTaxonomy(): Promise<BlogTaxonomyIndex> {
  const taxonomy = await loadYaml("blog/taxonomy.yaml", blogTaxonomySchema);
  const lookup = (kind: string, terms: BlogTerm[]) => {
    const bySlug = new Map(terms.map((term) => [term.slug, term]));
    return (slug: string) => {
      const term = bySlug.get(slug);
      if (!term) throw new Error(`${kind} „${slug}“ fehlt in content/blog/taxonomy.yaml`);
      return term;
    };
  };
  return {
    author: lookup("Autor", taxonomy.authors),
    category: lookup("Kategorie", taxonomy.categories),
    tag: lookup("Schlagwort", taxonomy.tags),
    authors: taxonomy.authors,
    categories: taxonomy.categories,
    tags: taxonomy.tags,
  };
}

/** Featured image metadata of content/blog/media.yaml by attachment ID. */
export async function getBlogMedia(): Promise<Map<number, BlogMediaItem>> {
  const media = await loadYaml("blog/media.yaml", blogMediaSchema);
  return new Map(media.map((item) => [item.id, item]));
}
