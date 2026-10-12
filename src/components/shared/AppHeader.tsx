import { Fragment, type CSSProperties } from "react";
import { asset } from "@/lib/base-path";
import { getAppLinks } from "@/lib/content";
import { StoreBadge } from "./StoreBadge";

/** Inline <style> of the badge templates (kept as in the original). */
export const SECOND_BADGE_CSS = `
@media (min-width: 992px) {
  #secondbadge {
    padding-left: 25px;
  }
}
`;

// init_home() / init_wahlometer() call $(".slide-…").toggle(); these are the
// inline styles jQuery leaves behind (the CSS partly overrides them with !important).
const HIDDEN = { display: "none" };
const BLOCK = { display: "block" };
const INLINE = { display: "inline" };

/** "1.5" → <p id="index-title-year">1</p> <p id="index-title-year-period">.</p> … */
export function VersionDigits({
  version,
  prefix,
  className,
  style,
}: {
  version: string;
  prefix: "index-title" | "wom-title";
  className?: string;
  style?: CSSProperties;
}) {
  return [...version].map((char, index) => (
    <Fragment key={index}>
      {index > 0 && " "}
      <p
        id={char === "." ? `${prefix}-year-period` : `${prefix}-year`}
        className={className}
        style={style}
      >
        {char}
      </p>
    </Fragment>
  ));
}

/**
 * Blue header of default_home.tpl and default_wahlometer.tpl: logo in the
 * background, title, store badges, download links and the phone screenshot.
 */
export async function AppHeader({
  variant,
  title,
  version,
  headline,
  apkLabel,
}: {
  variant: "home" | "wahlometer";
  title: string;
  version?: string;
  headline: string;
  /** Link text of the APK download, e.g. "APK (v1.5.10) " */
  apkLabel: string;
}) {
  const links = await getAppLinks();
  const home = variant === "home";
  const slide = home ? "slide-default" : "slide-wahlometer";

  return (
    <div className={home ? "header-home" : "header-wom"}>
      <div className="container page">
        <div className="row">
          <div className="background-logo">
            <img alt="" src={asset("/files/images/Logo-Landingpage.png")} />
          </div>
          <div className="col-lg-6 order-lg-12">
            <div className="header-content">
              <div className="header-content-inner">
                <h1 id="index-title" className={slide} style={HIDDEN}>
                  {title}
                </h1>
                {version && (
                  <>
                    <br id="index-title-year-break" />{" "}
                    <VersionDigits
                      version={version}
                      prefix="index-title"
                      className={slide}
                      style={HIDDEN}
                    />
                  </>
                )}
                <h1 id="index-headline" className={slide} style={BLOCK}>
                  {headline}
                </h1>
                <div className="badges">
                  <div className="row">
                    <div className="col-lg-5">
                      <br />
                      <StoreBadge
                        store="app-store"
                        href={links.appStore}
                        style={{ paddingTop: "5px" }}
                      />
                    </div>
                    <style>{SECOND_BADGE_CSS}</style>
                    <div id="secondbadge" className="col-lg-5">
                      <br />
                      <StoreBadge
                        store="google-play"
                        href={links.playStore}
                        style={{ paddingTop: "5px" }}
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-lg-5">
                      <br />
                      {"\u00a0"}
                      <a className="whitelink" href={links.browserVersion} target="_blank">
                        zur Browserversion
                      </a>
                    </div>
                    <div id="secondbadge" className="col-lg-5">
                      <br />
                      {"\u00a0"}
                      <a
                        className="whitelink"
                        href={links.aab}
                        target="_blank"
                        title="Android App Bundle"
                      >
                        AAB
                      </a>{" "}
                      <p style={{ fontSize: "20px", display: "inline" }}> / </p>{" "}
                      <a
                        className="whitelink"
                        href={links.apk}
                        target="_blank"
                        title="Android Package"
                      >
                        {apkLabel}
                      </a>{" "}
                      laden
                      <br />
                    </div>
                  </div>
                </div>
                <br />
              </div>
            </div>
          </div>
          <div className="col-lg-1 order-lg-6"></div>
          <div className="col-lg-5 order-lg-1">
            <div className="device-container">
              {home && (
                <img
                  alt=""
                  className="translateImg slide-default"
                  src={asset("/files/images/List.png")}
                  style={INLINE}
                />
              )}
              <img
                alt=""
                className="translateImg slide-wahlometer"
                src={asset("/files/images/WahlOMeter.png")}
                style={home ? undefined : INLINE}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
