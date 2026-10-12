import { MDXRemote } from "next-mdx-remote/rsc";
import { getPage } from "@/lib/content";
import { buildMetadata } from "@/lib/metadata";
import { mdxComponents } from "./MDXComponents";

/** Renders content/pages/<id>.mdx; every page.tsx under src/app only calls this. */
export async function MdxPage({ id }: { id: string }) {
  const { content } = await getPage(id);
  // blockJS: false – the MDX files are trusted repo content and need JS
  // expressions in props (style={{…}}, subtitle={<>…</>}). next-mdx-remote v6
  // otherwise drops them silently; blockDangerousJS stays on.
  return <MDXRemote source={content} components={mdxComponents} options={{ blockJS: false }} />;
}

/** Head data for content/pages/<id>.mdx. */
export async function mdxPageMetadata(id: string) {
  const { frontmatter } = await getPage(id);
  return buildMetadata(frontmatter);
}
