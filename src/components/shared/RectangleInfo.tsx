import type { ReactNode } from "react";
import { Link } from "./Link";

/** Grey rotated title box with text and "Mehr erfahren" link (default_home.tpl). */
export function RectangleInfo({
  id,
  title,
  subtitle,
  linkHref,
  linkLabel,
  children,
}: {
  id: string;
  title: string;
  subtitle: ReactNode;
  linkHref: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="ri-container" id={id}>
      <div className="rectangleinfo">
        <div className="ri-title">
          <h3 className="ri-title-heading">{title}</h3>
        </div>
        <div className="ri-subtitle">
          <p className="ri-subtitle-heading">{subtitle}</p>
        </div>
      </div>
      <div className="ri-content">
        {children}
        <Link className="ri-link" href={linkHref}>
          {linkLabel}
        </Link>
      </div>
    </div>
  );
}
