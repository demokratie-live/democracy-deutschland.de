import type { ReactNode } from "react";
import { asset } from "@/lib/base-path";
import { headStyles, tailStyles, type InlineStyle } from "@/lib/blog/styles";
import { getSidebarData, ORIGIN, searchInputNumber, type BlogView } from "@/lib/blog/view";
import { getBlogSite } from "@/lib/content";
import { BlogHeader } from "./BlogHeader";
import { Credits } from "./Credits";
import { HeaderImage } from "./HeaderImage";
import { Sidebar } from "./Sidebar";

const THEME = "/blog/wp-content/themes/lovecraft";
/** header.php: the theme switches the class to "js" before rendering. */
const NO_JS =
  'document.documentElement.className = document.documentElement.className.replace("no-js","js");';

function Styles({ styles }: { styles: InlineStyle[] }) {
  return styles.map((style, index) => (
    <style
      key={style.id ?? index}
      id={style.id}
      type={style.type}
      dangerouslySetInnerHTML={{ __html: style.css }}
    />
  ));
}

/**
 * Document of the Lovecraft theme: <head> like WordPress without its API
 * links and scripts (docs/abweichungen.md), header, header image, content
 * column, sidebar and credits. Root layout of every blog page.
 */
export async function BlogDocument({ view, children }: { view: BlogView; children: ReactNode }) {
  const [site, sidebar, head, tail] = await Promise.all([
    getBlogSite(),
    getSidebarData(),
    headStyles(view.classes),
    tailStyles(view.classes),
  ]);
  const single = view.kind === "single" ? view.post : undefined;

  return (
    <html lang="de" className="no-js" suppressHydrationWarning>
      {/* Root layout markup of the blog (the rule only knows app/layout). */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <title>{view.title}</title>
        <meta name="robots" content="max-image-preview:large" />
        <script dangerouslySetInnerHTML={{ __html: NO_JS }} />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${site.title} » Feed`}
          href={asset("/blog/feed/")}
        />
        {view.kind === "index" && view.feed ? (
          <link
            rel="alternate"
            type="application/rss+xml"
            title={view.feed.title}
            href={asset(view.feed.href)}
          />
        ) : null}
        <Styles styles={head} />
        <link
          rel="stylesheet"
          id="lovecraft_googlefonts-css"
          href={asset(`${THEME}/assets/css/fonts.css?ver=7.1.3`)}
          media="all"
        />
        <link
          rel="stylesheet"
          id="lovecraft_genericons-css"
          href={asset(`${THEME}/assets/css/genericons.min.css?ver=7.1.3`)}
          media="all"
        />
        <link
          rel="stylesheet"
          id="lovecraft_style-css"
          href={asset(`${THEME}/style.css?ver=2.1.1`)}
          media="all"
        />
        {single ? (
          <>
            <link rel="canonical" href={`${ORIGIN}${single.permalink}`} />
            <link rel="shortlink" href={`${ORIGIN}/blog/?p=${single.wpId}`} />
          </>
        ) : null}
        <Styles styles={tail} />
      </head>
      <body className={view.bodyClass}>
        <a className="skip-link button" href="#site-content">
          Zum Inhalt springen
        </a>
        <BlogHeader
          title={site.title}
          home={asset("/blog/")}
          titleTag={view.kind === "index" && !view.heading ? "h1" : "div"}
        />
        <HeaderImage headerImage={site.headerImage} featured={single?.featured} />
        <main id="site-content">
          <div className="wrapper section">
            <div className="section-inner group">
              <div className="content">{children}</div>
              <Sidebar
                data={sidebar}
                searchNumber={searchInputNumber(view.classes)}
                current={view.kind === "index" ? view.current : undefined}
              />
            </div>
          </div>
        </main>
        <Credits />
      </body>
    </html>
  );
}
