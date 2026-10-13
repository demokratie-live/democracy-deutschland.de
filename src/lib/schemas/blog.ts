import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9-]+$/, "WordPress-Slug (a-z, 0-9, -)");

const localDateTime = z
  .string({ error: 'Datum als String in Anführungszeichen: "JJJJ-MM-TTTHH:MM:SS"' })
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 'Format "JJJJ-MM-TTTHH:MM:SS"');

const uploadPath = z
  .string()
  .regex(/^\/blog\/wp-content\/uploads\//, "Pfad unter /blog/wp-content/uploads/");

/**
 * Frontmatter of a blog post, content/blog/<slug>.md (WordPress post),
 * written by `pnpm import-blog` (scripts/import-blog.ts). The body is the
 * post content as Markdown with inline HTML (see AGENTS.md, "Blog").
 */
export const blogPostFrontmatterSchema = z.object({
  /** WordPress post ID (`?p=<id>`). */
  wpId: z.number().int().positive(),
  /**
   * `guid`: identity of the post in feeds, fixed when it was created (older
   * posts carry https://www.democracy-deutschland.de/blog/?p=<id>).
   */
  guid: z.url(),
  /** `post_title` as stored in WordPress, without wptexturize ("'25", not "’25"). */
  title: z.string().min(1),
  /** `post_name`; the permalink is /blog/<year>/<month>/<slug>/. */
  slug,
  /** `post_date`, local time (Europe/Berlin), quoted: "2026-06-14T10:20:02". */
  date: localDateTime,
  /** `post_modified`, local time (Europe/Berlin). */
  modified: localDateTime,
  /** Author slug (/blog/author/<slug>/), see content/blog/taxonomy.yaml. */
  author: slug,
  /** Category slugs (/blog/category/<slug>/), see content/blog/taxonomy.yaml. */
  categories: z.array(slug).min(1),
  /** Tag slugs in display order (by name), see content/blog/taxonomy.yaml. */
  tags: z.array(slug).default([]),
  /**
   * `_thumbnail_id`: attachment ID of the featured image, 0 without one. It can
   * point to a deleted attachment (then `image` is missing and WordPress shows
   * an empty image frame).
   */
  featuredMedia: z.number().int().nonnegative(),
  /** Featured image, original upload; its sizes are in content/blog/media.yaml. */
  image: uploadPath.optional(),
  /** Automatic excerpt (`the_excerpt`) as plain text, e.g. for the feed. */
  excerpt: z.string(),
});
export type BlogPostFrontmatter = z.infer<typeof blogPostFrontmatterSchema>;

const term = z.object({ id: z.number().int().positive(), slug, name: z.string().min(1) });

/** content/blog/taxonomy.yaml: authors, categories and tags used by the posts. */
export const blogTaxonomySchema = z.object({
  authors: z.array(term),
  categories: z.array(term),
  tags: z.array(term),
});
export type BlogTaxonomy = z.infer<typeof blogTaxonomySchema>;
export type BlogTerm = z.infer<typeof term>;

const imageSize = z.object({
  file: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/**
 * content/blog/media.yaml: the featured images (`_wp_attachment_metadata`),
 * enough to build `wp_get_attachment_image()` with srcset like WordPress.
 * `sizes` keeps the order of the metadata, srcset depends on it.
 */
export const blogMediaSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    file: uploadPath,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sizes: z.array(imageSize.extend({ name: z.string().min(1) })),
  }),
);
export type BlogMedia = z.infer<typeof blogMediaSchema>;
export type BlogMediaItem = BlogMedia[number];

/** content/blog/site.yaml: blog settings of WordPress (Customizer, Reading, widgets). */
export const blogSiteSchema = z.object({
  title: z.string().min(1),
  headerImage: uploadPath,
  postsPerPage: z.number().int().positive(),
  latestPosts: z.number().int().positive(),
  /** Settings > Reading: feeds show the newest … posts (posts_per_rss). */
  postsPerFeed: z.number().int().positive(),
});
export type BlogSite = z.infer<typeof blogSiteSchema>;
