import { BASE_PATH } from "./base-path";
import { getAppLinks, getBlogPosts, getRoutes, loadYaml } from "./content";
import { buildHtaccess } from "./htaccess";
import { blogTaxonomySchema } from "./schemas";

/**
 * GET handler of /.htaccess. With output: "export" it becomes out/.htaccess,
 * the Apache configuration for Plesk (src/lib/htaccess.ts).
 */
export async function GET() {
  const [routes, appLinks, posts, taxonomy] = await Promise.all([
    getRoutes(),
    getAppLinks(),
    getBlogPosts(),
    loadYaml("blog/taxonomy.yaml", blogTaxonomySchema),
  ]);
  const body = buildHtaccess({
    routes,
    appLinks,
    posts: posts.map((post) => ({ wpId: post.frontmatter.wpId, permalink: post.permalink })),
    categories: taxonomy.categories,
    authors: taxonomy.authors,
    basePath: BASE_PATH,
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
