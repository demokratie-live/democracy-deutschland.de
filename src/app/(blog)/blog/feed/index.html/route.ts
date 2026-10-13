import { feedResponse } from "@/lib/blog/feed";

// /blog/feed/: a static host serves the directory index, so the feed is
// exported as index.html (Content-Type see docs/abweichungen.md).
export const dynamic = "force-static";

export function GET() {
  return feedResponse("");
}
