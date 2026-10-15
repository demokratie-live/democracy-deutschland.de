import { z } from "zod";

/**
 * Frontmatter of content/pages/*.mdx.
 *
 * Head data defaults to content/site/head.yaml; a page only lists what differs
 * on live (title, single meta names or Open Graph values).
 */
export const pageFrontmatterSchema = z.object({
  /** State of the old hash router, must exist in content/site/routes.yaml. */
  state: z.string(),
  title: z.string().optional(),
  meta: z.record(z.string(), z.string()).optional(),
  openGraph: z
    .object({
      url: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
    })
    .optional(),
});
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;
