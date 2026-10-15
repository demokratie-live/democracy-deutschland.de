import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteDocument, siteViewport } from "@/components/frame/SiteDocument";
import { buildMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata();
}

export async function generateViewport(): Promise<Viewport> {
  return siteViewport();
}

/** Root layout of the website pages; the blog under /blog/ has its own (src/app/(blog)). */
export default function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteDocument>{children}</SiteDocument>;
}
