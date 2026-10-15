import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Bootstrap 4.0.0 Collapse without jQuery, for one `.collapse` element whose
 * state lives in React: classes from `collapseClass(phase)`, height transition
 * from `useCollapseTransition()`. Like the plugin, show() and hide() are
 * ignored while a transition runs; callers check the phase first.
 */
export type CollapsePhase = "hidden" | "showing" | "shown" | "hiding";

/** Collapse.TRANSITION_DURATION, the emulateTransitionEnd fallback. */
export const COLLAPSE_TRANSITION_DURATION = 600;

export function collapseClass(phase: CollapsePhase): string {
  if (phase === "shown") return "collapse show";
  if (phase === "hidden") return "collapse";
  return "collapsing";
}

export const isExpanded = (phase: CollapsePhase) => phase === "showing" || phase === "shown";

/**
 * First half of Collapse.hide(): fix the current height before the classes
 * switch to "collapsing" (call it right before setting the phase "hiding").
 */
export function prepareHide(element: HTMLElement | null) {
  if (!element) return;
  element.style.height = `${element.getBoundingClientRect().height}px`;
  void element.offsetHeight; // Util.reflow
}

/**
 * Height transition of Collapse.show()/hide(); calls `onComplete` on
 * transitionend (or after 600 ms) to switch to "shown"/"hidden".
 */
export function useCollapseTransition(
  ref: RefObject<HTMLElement | null>,
  phase: CollapsePhase,
  onComplete: () => void,
) {
  const complete = useRef(onComplete);
  useLayoutEffect(() => {
    complete.current = onComplete;
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || (phase !== "showing" && phase !== "hiding")) return;

    if (phase === "showing") {
      element.style.height = "0px";
      element.style.height = `${element.scrollHeight}px`;
    } else {
      element.style.height = "";
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      element.style.height = "";
      complete.current();
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === element) finish();
    };
    element.addEventListener("transitionend", onTransitionEnd);
    const timeout = window.setTimeout(finish, COLLAPSE_TRANSITION_DURATION);
    return () => {
      element.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(timeout);
    };
  }, [ref, phase]);
}
