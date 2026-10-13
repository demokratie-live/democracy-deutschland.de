"use client";

import { useLayoutEffect } from "react";

/**
 * The inline <script> of donate_details.tpl: stretches each row's bar
 * (.donate-detail-progress, position absolute) over its row, again on resize.
 */
export function UpdateProgress() {
  useLayoutEffect(() => {
    const updateProgress = () => {
      document.querySelectorAll<HTMLTableRowElement>(".donate-details tr").forEach((tr) => {
        const pr = tr.querySelector<HTMLElement>(".donate-detail-progress");
        if (pr) {
          pr.style.height = `${tr.clientHeight - 1}px`;
          pr.style.top = `${tr.offsetTop}px`;
        }
      });
    };
    updateProgress();
    // Live runs the script when the page content arrives via AJAX, after the
    // web fonts; a static page can hydrate before them, so measure again.
    document.fonts.ready.then(updateProgress);
    window.addEventListener("resize", updateProgress);
    return () => window.removeEventListener("resize", updateProgress);
  }, []);
  return null;
}
