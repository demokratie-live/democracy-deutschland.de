import type { CSSProperties, ReactNode } from "react";
import { asset } from "@/lib/base-path";

/** "bekannt aus" heading with the row of press logos. */
export function PressLogos({
  heading,
  headingId,
  children,
}: {
  heading: string;
  headingId?: string;
  children: ReactNode;
}) {
  return (
    <>
      <h1 className="press-heading" id={headingId}>
        {heading}
      </h1>
      <div id="press-logos">{children}</div>
    </>
  );
}

/** Live the links carry target=”_blank” (curly quotes); fixed to _blank. */
export function PressLogo({
  id,
  href,
  src,
  alt,
  style,
  imgStyle,
}: {
  id: string;
  href: string;
  src: string;
  alt: string;
  style?: CSSProperties;
  imgStyle?: CSSProperties;
}) {
  return (
    <a href={href} id={id} style={style} target="_blank">
      <img src={asset(src)} alt={alt} style={imgStyle} />
    </a>
  );
}
