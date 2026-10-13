import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { PostSingle } from "@/components/blog/PostSingle";
import { blogStaticParams, getBlogView } from "@/lib/blog/view";

export const dynamicParams = false;

export function generateStaticParams() {
  return blogStaticParams();
}

/** Content column of a blog page: post list or single post. */
export default async function BlogPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const view = await getBlogView(path.join("/"));
  if (!view) notFound();
  return view.kind === "index" ? <BlogIndex view={view} /> : <PostSingle view={view} />;
}
