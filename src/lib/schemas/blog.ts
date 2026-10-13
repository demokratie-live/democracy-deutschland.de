import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9-]+$/, "WordPress-Slug (a-z, 0-9, -)");

/**
 * Frontmatter of a blog post, content/blog/<slug>.md (WordPress post).
 *
 * Until the blog import (TASK-80) the directory only holds frontmatter stubs
 * of the newest posts for the teasers on /presse/. The import may add fields
 * (excerpt …); the teasers read `title`, `slug`, `date` and `image`.
 */
export const blogPostFrontmatterSchema = z.object({
  /** WordPress post ID (`?p=<id>`). */
  wpId: z.number().int().positive(),
  /** `post_title` as stored in WordPress, without wptexturize ("'25", not "’25"). */
  title: z.string().min(1),
  /** `post_name`; the permalink is /blog/<year>/<month>/<slug>/. */
  slug,
  /** `post_date`, local time (Europe/Berlin), quoted: "2026-06-14T10:20:02". */
  date: z
    .string({ error: 'Datum als String in Anführungszeichen: "JJJJ-MM-TTTHH:MM:SS"' })
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 'Format "JJJJ-MM-TTTHH:MM:SS"'),
  /** Author slug (/blog/author/<slug>/). */
  author: slug,
  categories: z.array(slug).min(1),
  tags: z.array(z.string().min(1)).default([]),
  /** Featured image, original upload under public/blog/wp-content/uploads/. */
  image: z
    .string()
    .regex(/^\/blog\/wp-content\/uploads\//, "Pfad unter /blog/wp-content/uploads/")
    .optional(),
});
export type BlogPostFrontmatter = z.infer<typeof blogPostFrontmatterSchema>;
