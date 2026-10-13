import type { ImgHTMLAttributes } from "react";
import { asset } from "@/lib/base-path";

/**
 * Plain <img> for MDX: `src` is a path under public/ ("/files/images/…") and
 * gets the basePath. `alt` defaults to "" where the original has none.
 */
export function Img({
  src,
  alt = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  return <img src={asset(src)} alt={alt} {...props} />;
}
