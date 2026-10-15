"use client";

import { animateScrollTo, offsetTop } from "@/lib/animate";

/**
 * Chevron at the bottom of the header: scrolls to the first #about in 750 ms.
 * Live the link also follows href="#", which makes the hash router load the
 * start page; that bug is fixed here (docs/abweichungen.md).
 */
export function ScrollIcon() {
  return (
    <div className="scroll-icon-container d-none d-lg-block">
      <a
        href="#"
        className="scroll-icon"
        onClick={(event) => {
          event.preventDefault();
          const about = document.getElementById("about");
          if (about) animateScrollTo(offsetTop(about), 750);
        }}
      >
        <i className="fa fa-chevron-circle-down"></i>
      </a>
    </div>
  );
}
