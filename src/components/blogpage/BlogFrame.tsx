"use client";

import { useEffect, useRef } from "react";
import { asset } from "@/lib/base-path";

/**
 * default_blog.tpl: the blog in an iframe, as high as its page. Live,
 * `onload="resizeIframe(this)"` sets the height attribute to the body's
 * scrollHeight on every load of the frame, also after a link inside it.
 */
export function BlogFrame({ src }: { src: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    const resize = () => {
      try {
        const body = iframe.contentWindow?.document.body;
        if (body) iframe.height = `${body.scrollHeight}px`;
      } catch {
        // A frame of another origin keeps its height, like live.
      }
    };
    iframe.addEventListener("load", resize);
    // The static page may finish loading the frame before React runs.
    const loaded = iframe.contentDocument;
    if (loaded?.readyState === "complete" && loaded.location.href !== "about:blank") resize();
    return () => iframe.removeEventListener("load", resize);
  }, []);

  return (
    <iframe
      ref={frame}
      id="blogiframe"
      src={asset(src)}
      frameBorder="0"
      style={{ width: "100%", minHeight: "150vh" }}
    ></iframe>
  );
}
