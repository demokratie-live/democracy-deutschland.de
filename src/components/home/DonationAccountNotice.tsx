import { Fragment, type CSSProperties } from "react";
import { Link } from "@/components/shared/Link";
import { asset } from "@/lib/base-path";

// Not part of the original site: a temporary notice in the home header
// (docs/abweichungen.md). Inline styles only, no new global CSS. The card is
// inline-block, so it follows the header's text-align (centred on mobile,
// left on desktop).
const CARD: CSSProperties = {
  display: "inline-block",
  maxWidth: "460px",
  margin: "15px 0 5px",
  padding: "12px 16px",
  background: "#fff",
  color: "#333",
  borderRadius: "6px",
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
  textAlign: "left",
  fontSize: "14px",
  lineHeight: 1.4,
};
const HEADING: CSSProperties = { display: "block", fontSize: "16px", color: "#4494d3" };
const TEXT: CSSProperties = { margin: "4px 0 6px" };
const IBAN: CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: "bold",
  letterSpacing: "0.5px",
  color: "#222",
  userSelect: "all",
};
const SMALL: CSSProperties = { margin: "0 0 6px", fontSize: "12px", color: "#666" };
const NOWRAP: CSSProperties = { whiteSpace: "nowrap" };
const LINKS: CSSProperties = { margin: 0 };
const LINK: CSSProperties = { color: "#4494d3", fontWeight: "bold" };

/**
 * Home header: notice that the donation account has moved. Rendered as a
 * child of AppHeader between headline and store badges; remove the element
 * from content/pages/home.mdx to drop it.
 */
export function DonationAccountNotice({
  heading,
  text,
  iban,
  holder,
  bank,
  bic,
  note,
  blogHref,
  blogLabel,
  donateHref,
  donateLabel,
}: {
  heading: string;
  text: string;
  iban: string;
  holder: string;
  bank: string;
  bic: string;
  /** Optional small line, e.g. who does not need to change anything */
  note?: string;
  blogHref: string;
  blogLabel: string;
  donateHref: string;
  donateLabel: string;
}) {
  return (
    <div id="donation-account-notice" role="note" style={CARD}>
      <b style={HEADING}>
        <i className="fa fa-info-circle" aria-hidden="true"></i> {heading}
      </b>
      <p style={TEXT}>{text}</p>
      <p className="donation-account-iban" style={IBAN}>
        {iban}
      </p>
      <p style={SMALL}>
        {[holder, bank, `BIC ${bic}`].map((part, index) => (
          <Fragment key={index}>
            {index > 0 && " · "}
            <span style={NOWRAP}>{part}</span>
          </Fragment>
        ))}
      </p>
      {note && <p style={SMALL}>{note}</p>}
      <p style={LINKS}>
        {/* The blog has its own root layout: a plain link loads the full page like the blog does. */}
        <a href={asset(blogHref)} style={LINK}>
          {blogLabel}
        </a>
        {" · "}
        <Link href={donateHref} style={LINK}>
          {donateLabel}
        </Link>
      </p>
    </div>
  );
}
