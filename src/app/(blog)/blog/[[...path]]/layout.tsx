import type { Viewport } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BlogDocument } from "@/components/blog/BlogDocument";
import { getBlogView } from "@/lib/blog/view";

/** Viewport of the Lovecraft header. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Root layout of the blog (WordPress theme Lovecraft): /blog/, /blog/page/<n>/
 * and the permalinks. One catch-all route, so the document (head styles, body
 * class, header image) can depend on the page like in WordPress.
 */
export default async function BlogLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const view = await getBlogView(path.join("/"));
  if (!view) notFound();
  return <BlogDocument view={view}>{children}</BlogDocument>;
}
