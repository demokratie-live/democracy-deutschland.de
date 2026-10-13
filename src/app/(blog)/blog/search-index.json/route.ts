import { buildSearchIndex } from "@/lib/blog/search-index";

// Data of the client search (src/components/blog/BlogSearch.tsx).
export const dynamic = "force-static";

export async function GET() {
  return Response.json(await buildSearchIndex());
}
