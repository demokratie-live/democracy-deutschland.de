"use client";

import { useEffect, useRef } from "react";
import { animateScrollTo, easings, tween, type Tween } from "@/lib/animate";

// $().UItoTop({ easingType: 'easeOutQuart' }) with the plugin defaults
// (lib/move_top/move-top.min.js).
const MIN = 200;
const IN_DELAY = 600;
const OUT_DELAY = 400; // settings.Outdelay is undefined, so jQuery's default
const SCROLL_SPEED = 1000;

/** UItoTop button: fades in below 200px scroll position, scrolls to the top. */
export function ToTop() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hoverRef = useRef<HTMLSpanElement>(null);
  const hoverTween = useRef<Tween | null>(null);

  const animateHover = (to: number, duration: number, easing = easings.linear) => {
    const hover = hoverRef.current;
    if (!hover) return;
    hoverTween.current?.stop();
    const from = Number(getComputedStyle(hover).opacity);
    hoverTween.current = tween(from, to, duration, easing, (value) => {
      hover.style.opacity = String(value);
    });
  };

  // $(window).scroll(): fadeIn above MIN, fadeOut below.
  useEffect(() => {
    const link = linkRef.current;
    if (!link) return;
    let visible = false;
    let fade: Tween | null = null;

    const onScroll = () => {
      const shouldShow = window.scrollY > MIN;
      if (shouldShow === visible) return;
      visible = shouldShow;
      fade?.stop();
      const from = link.style.display === "none" ? 0 : Number(getComputedStyle(link).opacity);
      if (shouldShow) {
        link.style.display = "inline";
        fade = tween(from, 1, IN_DELAY, easings.swing, (value) => {
          link.style.opacity = String(value);
        });
      } else {
        fade = tween(
          from,
          0,
          OUT_DELAY,
          easings.swing,
          (value) => {
            link.style.opacity = String(value);
          },
          () => {
            link.style.display = "none";
            link.style.opacity = "";
          },
        );
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      fade?.stop();
    };
  }, []);

  return (
    <a
      href="#"
      id="toTop"
      ref={linkRef}
      style={{ display: "none" }}
      onClick={(event) => {
        event.preventDefault();
        animateScrollTo(0, SCROLL_SPEED, easings.easeOutQuart);
        animateHover(0, IN_DELAY, easings.easeOutQuart);
      }}
      onMouseEnter={() => animateHover(1, 600)}
      onMouseLeave={() => animateHover(0, 700)}
    >
      <span id="toTopHover" ref={hoverRef}></span>
      To Top
    </a>
  );
}
