import { asset } from "@/lib/base-path";
import { getRoutes } from "@/lib/content";
import { normalizePath } from "@/lib/routes";

/** Forwarding pages for content/site/routes.yaml `aliases` (e.g. /democracy/ → /). */
export const dynamicParams = false;

export async function generateStaticParams() {
  const { aliases } = await getRoutes();
  return aliases.map(({ from }) => ({ alias: from.split("/").filter(Boolean) }));
}

export default async function AliasPage({ params }: { params: Promise<{ alias: string[] }> }) {
  const { alias } = await params;
  const { aliases } = await getRoutes();
  const from = normalizePath(`/${alias.join("/")}`);
  const target = asset(aliases.find((entry) => entry.from === from)?.to ?? "/");
  // LegacyRedirectScript forwards immediately; the refresh covers disabled JS.
  return <meta httpEquiv="refresh" content={`0;url=${target}`} />;
}
