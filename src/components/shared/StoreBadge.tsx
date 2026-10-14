"use client";

import { useState, type CSSProperties } from "react";
import { asset } from "@/lib/base-path";

const ICON = { "app-store": "icon-app-store", "google-play": "icon-google-play" } as const;

/**
 * App Store / Google Play badge from the icomoon font.
 * `$(".icon-app-store-outline").hover(fn)` binds fn to mouseenter and
 * mouseleave, so the filled icon is toggled on both.
 */
export function StoreBadge({
  store,
  href,
  id,
  style,
  target,
}: {
  store: keyof typeof ICON;
  href: string;
  id?: string;
  style?: CSSProperties;
  target?: string;
}) {
  const [filled, setFilled] = useState(false);
  const toggle = () => setFilled((value) => !value);
  const icon = ICON[store];
  return (
    <a
      className={`badge-link ${icon}-outline${filled ? ` ${icon}-filled` : ""}`}
      id={id}
      href={asset(href)}
      target={target}
      style={style}
      onMouseEnter={toggle}
      onMouseLeave={toggle}
    ></a>
  );
}
