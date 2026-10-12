import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/frame/Footer";
import { LegacyRedirectScript } from "@/components/frame/LegacyRedirectScript";
import { Navbar } from "@/components/frame/Navbar";
import { ToTop } from "@/components/frame/ToTop";
import { asset } from "@/lib/base-path";
import { getFooter, getHead, getNavigation, getRoutes } from "@/lib/content";
import { buildMetadata } from "@/lib/metadata";
import { ORIGINAL_STYLESHEETS } from "@/lib/stylesheets";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata();
}

export async function generateViewport(): Promise<Viewport> {
  const head = await getHead();
  return { width: "device-width", initialScale: 1, themeColor: head.meta["theme-color"] };
}

/** Frame of default_page.tpl: navbar, <section id="content">, footer, UItoTop. */
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [head, routes, navigation, footer] = await Promise.all([
    getHead(),
    getRoutes(),
    getNavigation(),
    getFooter(),
  ]);

  return (
    <html lang="de">
      <head>
        <LegacyRedirectScript routes={routes} />
        {ORIGINAL_STYLESHEETS.map((href) => (
          <link key={href} rel="stylesheet" href={asset(href)} />
        ))}
        {head.externalStylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <Navbar navigation={navigation} routes={routes.routes} />
        <section id="content">{children}</section>
        <Footer footer={footer} />
        <ToTop />
      </body>
    </html>
  );
}
