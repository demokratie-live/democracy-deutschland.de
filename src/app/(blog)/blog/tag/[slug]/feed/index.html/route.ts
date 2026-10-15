import { feedResponse, feedStaticParams } from "@/lib/blog/feed";

// /blog/tag/<slug>/feed/, exported as index.html like /blog/feed/.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return feedStaticParams("tag");
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return feedResponse(`tag/${slug}`);
}
