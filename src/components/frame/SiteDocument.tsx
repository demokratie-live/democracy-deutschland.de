import type { ReactNode } from "react";
import { Footer } from "@/components/frame/Footer";
import { LegacyRedirectScript } from "@/components/frame/LegacyRedirectScript";
import { Navbar } from "@/components/frame/Navbar";
import { ToTop } from "@/components/frame/ToTop";
import { asset } from "@/lib/base-path";
import { getFooter, getHead, getNavigation, getRoutes } from "@/lib/content";
import { ORIGINAL_STYLESHEETS } from "@/lib/stylesheets";

/**
 * Frame of default_page.tpl: navbar, <section id="content">, footer, UItoTop.
 * Root layout of the website pages (src/app/(site)/layout.tsx) and of the
 * 404 page (src/app/global-not-found.tsx); the blog has its own frame.
 */
export async function SiteDocument({ children }: { children: ReactNode }) {
  const [head, routes, navigation, footer] = await Promise.all([
    getHead(),
    getRoutes(),
    getNavigation(),
    getFooter(),
  ]);

  return (
    <html lang="de">
      {/* Root layout markup, shared with global-not-found (the rule only knows app/layout). */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
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

/** Viewport of the website pages (theme-color from head.yaml). */
export async function siteViewport() {
  const head = await getHead();
  return { width: "device-width", initialScale: 1, themeColor: head.meta["theme-color"] };
}
