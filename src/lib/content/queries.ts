import {
  appLinksSchema,
  footerSchema,
  headSchema,
  navigationSchema,
  pageFrontmatterSchema,
  routesSchema,
  type AppLinks,
  type Footer,
  type Head,
  type Navigation,
  type PageFrontmatter,
  type Routes,
} from "../schemas";
import { loadMdx } from "./load-mdx";
import { loadYaml } from "./load-yaml";

/** Load content/pages/<pageId>.mdx (pageId = file name without extension). */
export async function getPage(pageId: string) {
  return loadMdx<PageFrontmatter>(`pages/${pageId}.mdx`, pageFrontmatterSchema);
}

export async function getHead(): Promise<Head> {
  return loadYaml("site/head.yaml", headSchema);
}

export async function getRoutes(): Promise<Routes> {
  return loadYaml("site/routes.yaml", routesSchema);
}

export async function getNavigation(): Promise<Navigation> {
  return loadYaml("site/navigation.yaml", navigationSchema);
}

export async function getFooter(): Promise<Footer> {
  return loadYaml("site/footer.yaml", footerSchema);
}

export async function getAppLinks(): Promise<AppLinks> {
  return loadYaml("site/app-links.yaml", appLinksSchema);
}
