"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { animateScrollTo, offsetTop, SLOW } from "@/lib/animate";
import { normalizePath } from "@/lib/routes";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * Link for page content. Internal paths ("/ueber-uns/") go through next/link
 * (basePath, client navigation). An anchor on the current page scrolls like
 * SYSTEM.scroll() of the old hash router: animated, jQuery speed "slow".
 */
export function Link({ href, onClick, ...props }: LinkProps) {
  const pathname = usePathname();

  if (!href.startsWith("/")) {
    return <a href={href} onClick={onClick} {...props} />;
  }

  const [path, anchor] = href.split("#");
  const samePageAnchor = anchor && normalizePath(path) === normalizePath(pathname);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!samePageAnchor || event.defaultPrevented) return;
    const target = document.getElementById(anchor);
    if (!target) return;
    event.preventDefault();
    window.history.pushState(null, "", `#${anchor}`);
    animateScrollTo(offsetTop(target), SLOW);
  };

  return <NextLink href={href} onClick={handleClick} {...props} />;
}
