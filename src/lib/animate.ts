/**
 * Minimal replacement for the jQuery animations the live site uses
 * (`$('html,body').animate({scrollTop})`, `fadeIn`/`fadeOut`, `animate({opacity})`).
 * Durations and easings match jQuery 3.3.1 and lib/easing/easing.js.
 */

export type Easing = (progress: number) => number;

export const easings = {
  linear: (p: number) => p,
  /** jQuery default easing. */
  swing: (p: number) => 0.5 - Math.cos(p * Math.PI) / 2,
  /** lib/easing/easing.js: -c * ((t = t / d - 1) * t * t * t - 1) + b */
  easeOutQuart: (p: number) => 1 - Math.pow(p - 1, 4),
} satisfies Record<string, Easing>;

/** jQuery speed names. */
export const SLOW = 600;

export interface Tween {
  stop(): void;
}

/** Animate a number from `from` to `to`, calling `step` on every frame. */
export function tween(
  from: number,
  to: number,
  duration: number,
  easing: Easing,
  step: (value: number) => void,
  done?: () => void,
): Tween {
  let frame = 0;
  let stopped = false;
  const start = performance.now();

  const tick = (now: number) => {
    if (stopped) return;
    const progress = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
    step(from + (to - from) * easing(progress));
    if (progress < 1) {
      frame = requestAnimationFrame(tick);
    } else {
      done?.();
    }
  };
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
    },
  };
}

let scrollTween: Tween | null = null;

/** `$('html, body').animate({ scrollTop: y }, duration, easing)` */
export function animateScrollTo(y: number, duration: number, easing: Easing = easings.swing) {
  scrollTween?.stop();
  // Like jQuery the target is not clamped; the browser clamps every step.
  scrollTween = tween(window.scrollY, y, duration, easing, (value) => window.scrollTo(0, value));
}

/** jQuery `$(el).offset().top`: distance from the document top. */
export function offsetTop(element: Element): number {
  return element.getBoundingClientRect().top + window.scrollY;
}
