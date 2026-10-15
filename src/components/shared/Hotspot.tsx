"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Tooltip } from "@/lib/bootstrap-tooltip";

/**
 * Numbered hotspot with a Bootstrap tooltip (default_citizen.tpl,
 * default_politicians.tpl): `<div class="hotspot …" data-toggle="tooltip">`
 * after `$('[data-toggle="tooltip"]').tooltip()`, i.e. with title="" and the
 * text in data-original-title.
 */
export function Hotspot({
  className,
  title,
  placement = "top",
  children,
}: {
  className: string;
  title: string;
  placement?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tooltip = new Tooltip(ref.current!);
    return () => tooltip.dispose();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      data-toggle="tooltip"
      data-placement={placement}
      title=""
      data-original-title={title}
    >
      {children}
    </div>
  );
}
