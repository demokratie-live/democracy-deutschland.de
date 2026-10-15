import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeRaw from "rehype-raw";
import { Link } from "@/components/shared/Link";
import { getLegalText, type LegalTextName } from "@/lib/content";

/**
 * `${impressum_text}`, `${datenschutz_text}`, `${nutzungsbedingungen_text}` of
 * the legal templates: content/legal/<name>.md as plain Markdown (CommonMark)
 * with inline HTML, not MDX, so the texts stay readable anywhere and HTML needs
 * no JSX syntax (`<br>`, `style="…"`).
 */
export async function LegalText({ name }: { name: LegalTextName }) {
  const source = await getLegalText(name);
  return (
    <MDXRemote
      source={source}
      components={{ a: Link }}
      options={{ mdxOptions: { format: "md", rehypePlugins: [rehypeRaw] } }}
    />
  );
}
