import type { ReactNode } from "react";
import { SECOND_BADGE_CSS, VersionDigits } from "@/components/shared/AppHeader";
import { Link } from "@/components/shared/Link";
import { StoreBadge } from "@/components/shared/StoreBadge";
import { asset } from "@/lib/base-path";
import { getAppLinks } from "@/lib/content";

/** "Warum gibt es uns?" with link and founder quote (#wom-about). */
export function WhyUs({
  heading,
  linkHref,
  linkLabel,
  title,
  subtitle,
  quoteName,
  quoteRole,
  children,
}: {
  heading: string;
  linkHref: string;
  linkLabel: string;
  title: string;
  subtitle: ReactNode;
  quoteName: string;
  quoteRole: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="col-lg-12" style={{ display: "flex" }}>
        <h1>{heading}</h1>
        <Link
          href={linkHref}
          style={{
            color: "rgb(74,74,74)",
            fontSize: "20px",
            textAlign: "right",
            paddingTop: "22px",
            float: "right",
            flex: "100 0 0",
            zIndex: 800,
          }}
        >
          {linkLabel}
        </Link>
      </div>
      <div className="ri-container" id="ri-container-wom">
        <div className="rectangleinfo" id="rectangleinfo-wom">
          <div className="ri-title" id="ri-title-wom">
            <h3 className="ri-title-heading" id="ri-title-heading-wom">
              {title}
            </h3>
          </div>
          <div className="ri-subtitle">
            <p className="ri-subtitle-heading" id="ri-subtitle-heading-wom">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="ri-content" id="ri-content-wom">
          {children}
          <div className="quote-name" id="quote-name-wom">
            <a className="ri-link" id="ri-link-wom">
              <b className="ri-quote-bold">{quoteName}</b>
              {quoteRole}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

/** "Finde die Partei, die Dich wirklich vertritt" with the store badges. */
export async function Campaign({
  heading,
  title,
  version,
  subtitle,
}: {
  heading: string;
  title: string;
  version: string;
  subtitle: string;
}) {
  const links = await getAppLinks();
  return (
    <div id="wom-campaign-container">
      <h1 style={{ zIndex: 800, position: "relative" }}>{heading}</h1>
      <div id="wom-campaign-title">
        <h1 id="wom-title">{title}</h1> <br id="wom-title-year-break" />{" "}
        <VersionDigits version={version} prefix="wom-title" />
        <h1 id="wom-title-subtitle">{subtitle}</h1>
        <div id="wom-campaign-badges" className="badges">
          <div className="row">
            <div className="col-lg-5" id="firstbadge-wom">
              <br />
              <StoreBadge
                store="app-store"
                id="icon-app-store-outline-wom"
                href={links.appStore}
                style={{ paddingTop: "5px" }}
              />
            </div>
            <style>{SECOND_BADGE_CSS}</style>
            <div id="secondbadge-wom" className="col-lg-5">
              <br />
              <StoreBadge
                store="google-play"
                id="icon-google-play-outline-wom"
                href={links.playStore}
                style={{ paddingTop: "5px", zIndex: 800, position: "relative" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Campaign corner image at the bottom right of the section. */
export function CampaignCorner({ src, alt }: { src: string; alt: string }) {
  return (
    <a id="campaigncorner-anchor">
      <img src={asset(src)} alt={alt} id="campaigncorner-img" />
    </a>
  );
}
