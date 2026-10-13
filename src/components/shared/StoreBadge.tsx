"use client";

import { useState, type CSSProperties } from "react";
import { asset } from "@/lib/base-path";

const ICON = { "app-store": "icon-app-store", "google-play": "icon-google-play" } as const;

/**
 * App Store / Google Play badge from the icomoon font.
 * `$(".icon-app-store-outline").hover(fn)` binds fn to mouseenter and
 * mouseleave, so the filled icon is toggled on both. `variant="2"` is the
 * smaller badge of /engineering/ (`badge-link2`, `icon-…-outline2`).
 */
export function StoreBadge({
  store,
  href,
  id,
  style,
  target,
  variant = "",
}: {
  store: keyof typeof ICON;
  href: string;
  id?: string;
  style?: CSSProperties;
  target?: string;
  variant?: "" | "2";
}) {
  const [filled, setFilled] = useState(false);
  const toggle = () => setFilled((value) => !value);
  const icon = ICON[store];
  return (
    <a
      className={`badge-link${variant} ${icon}-outline${variant}${filled ? ` ${icon}-filled${variant}` : ""}`}
      id={id}
      href={asset(href)}
      target={target}
      style={style}
      onMouseEnter={toggle}
      onMouseLeave={toggle}
    ></a>
  );
}
