import { MDXRemote } from "next-mdx-remote/rsc";
import { getPage } from "@/lib/content";
import { buildMetadata, openGraphTags } from "@/lib/metadata";
import { mdxComponents } from "./MDXComponents";

/** Renders content/pages/<id>.mdx; every page.tsx under src/app only calls this. */
export async function MdxPage({ id }: { id: string }) {
  const { frontmatter, content } = await getPage(id);
  const ogTags = await openGraphTags(frontmatter);
  // blockJS: false – the MDX files are trusted repo content and need JS
  // expressions in props (style={{…}}, subtitle={<>…</>}). next-mdx-remote v6
  // otherwise drops them silently; blockDangerousJS stays on.
  return (
    <>
      {/* React hoists these into <head>. */}
      {ogTags.map(([property, value]) => (
        <meta key={property} property={property} content={value} />
      ))}
      <MDXRemote source={content} components={mdxComponents} options={{ blockJS: false }} />
    </>
  );
}

/** Head data for content/pages/<id>.mdx. */
export async function mdxPageMetadata(id: string) {
  const { frontmatter } = await getPage(id);
  return buildMetadata(frontmatter);
}
