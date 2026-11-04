"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@/components/shared/Link";
import { easings, tween, type Tween } from "@/lib/animate";
import { asset } from "@/lib/base-path";

// Not part of the original site: a temporary banner at the top of the start
// page (docs/abweichungen.md), like the fundraising banners of Wikipedia. It
// slides in, pushes page and navbar down, scrolls away with the page and can
// be closed; the browser remembers that. Inline styles only, no new global CSS.

/** localStorage key; change it to show the banner again to everyone who closed it. */
export const DISMISSED_KEY = "donation-account-notice-dismissed";
const DELAY = 500;
const DURATION = 400;

const BANNER: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  zIndex: 1031, // above the fixed-top navbar (1030)
  background: "#fff",
  color: "#333",
  borderBottom: "4px solid #4494d3",
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
  padding: "14px 0",
  fontSize: "14px",
  lineHeight: 1.4,
  textAlign: "left",
  transform: "translateY(-100%)",
};
const INNER: CSSProperties = {
  position: "relative",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px 24px",
};
const TEXT_COLUMN: CSSProperties = { flex: "1 1 320px" };
const HEADING: CSSProperties = {
  display: "block",
  paddingRight: "36px", // room for the close button
  fontSize: "16px",
  color: "#4494d3",
};
const TEXT: CSSProperties = { margin: "4px 0" };
const SMALL: CSSProperties = { margin: 0, fontSize: "12px", color: "#666" };
const LINKS: CSSProperties = { margin: "4px 0 0" };
const LINK: CSSProperties = { color: "#4494d3", fontWeight: "bold" };
const ACCOUNT: CSSProperties = {
  flex: "0 1 auto",
  background: "#eef5fb",
  borderRadius: "6px",
  padding: "8px 14px",
};
const IBAN: CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: "bold",
  color: "#222",
  userSelect: "all",
};
const NOWRAP: CSSProperties = { whiteSpace: "nowrap" };
const CLOSE: CSSProperties = {
  position: "absolute",
  top: "-6px",
  right: "15px",
  padding: "0 6px",
  border: 0,
  background: "none",
  color: "#666",
  fontSize: "30px",
  lineHeight: 1,
  cursor: "pointer",
};

function isDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // private mode or blocked storage: the banner comes back on the next visit
  }
}

/**
 * Start page: banner "Unser Spendenkonto hat sich geändert". Remove the
 * element from content/pages/home.mdx to drop it.
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
  closeLabel,
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
  /** aria-label of the close button */
  closeLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Pixels the banner currently pushes the page down (0 = closed, height = open).
  const offset = useRef(0);
  const animation = useRef<Tween | null>(null);
  const [visible, setVisible] = useState(false);

  // Moves banner, page and fixed navbar for the current offset and scroll position.
  const apply = (step: number) => {
    // Whole pixels: scrollBy() rounds, fractions would add up to a drift.
    const value = Math.round(step);
    const delta = value - offset.current;
    offset.current = value;
    const banner = ref.current;
    const navbar = document.querySelector<HTMLElement>(".navbar");
    if (banner) banner.style.transform = `translateY(${value - banner.offsetHeight}px)`;
    document.body.style.paddingTop = value > 0 ? `${value}px` : "";
    // A visitor who already scrolled keeps the reading position: the page moves
    // down under the viewport, the banner comes in above it.
    if (delta !== 0 && window.scrollY > 0) window.scrollBy(0, delta);
    if (navbar) navbar.style.top = value > 0 ? `${Math.max(0, value - window.scrollY)}px` : "";
  };

  useEffect(() => {
    if (isDismissed()) return;
    const timer = window.setTimeout(() => setVisible(true), DELAY);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const banner = ref.current;
    if (!visible || !banner) return;
    animation.current = tween(0, banner.offsetHeight, DURATION, easings.swing, apply, () => {
      animation.current = null;
    });
    const onScroll = () => apply(offset.current);
    // The banner wraps differently after a resize: keep it fully open.
    const onResize = () => {
      if (!animation.current) apply(banner.offsetHeight);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      animation.current?.stop();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      // Leaving the start page: the navbar and <body> stay, reset them.
      apply(0);
    };
  }, [visible]);

  const close = () => {
    rememberDismissed();
    animation.current?.stop();
    animation.current = tween(offset.current, 0, DURATION, easings.swing, apply, () =>
      setVisible(false),
    );
  };

  return (
    <div
      id="donation-account-notice"
      role="region"
      aria-label={heading}
      hidden={!visible}
      ref={ref}
      style={BANNER}
    >
      <div className="container" style={INNER}>
        <div style={TEXT_COLUMN}>
          <b style={HEADING}>
            <i className="fa fa-info-circle" aria-hidden="true"></i> {heading}
          </b>
          <p style={TEXT}>{text}</p>
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
        <div style={ACCOUNT}>
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
        </div>
        <button type="button" aria-label={closeLabel} onClick={close} style={CLOSE}>
          ×
        </button>
      </div>
    </div>
  );
}
