import type { Metadata, Viewport } from "next";
import { NotFound } from "@/components/frame/NotFound";
import { SiteDocument, siteViewport } from "@/components/frame/SiteDocument";
import { buildMetadata } from "@/lib/metadata";

// The app has two root layouts, (site) and (blog); unmatched paths get this
// page (out/404.html) in the website frame.

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata();
}

export async function generateViewport(): Promise<Viewport> {
  return siteViewport();
}

export default function GlobalNotFound() {
  return (
    <SiteDocument>
      <NotFound />
    </SiteDocument>
  );
}
