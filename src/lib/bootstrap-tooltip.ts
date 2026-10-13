/**
 * Bootstrap 4.0.0 Tooltip plugin (bootstrap.js "Tooltip") without jQuery, as
 * `$('[data-toggle="tooltip"]').tooltip()` sets it up: triggers "hover focus",
 * placement from data-placement, animation, container <body>, title from
 * data-original-title. Positioning is Popper.js 1.12.9 with Bootstrap's
 * options, the same library and version live loads.
 *
 * The element is server-rendered in the state after Tooltip._fixTitle()
 * (title="" and data-original-title); the tip element is created on the
 * first show and appended to <body> like the original.
 */

import Popper from "popper.js";

const TRANSITION_DURATION = 150;
const CLASS_PREFIX = "bs-tooltip";
const TEMPLATE =
  '<div class="tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner"></div></div>';
const MAX_UID = 1000000;

type HoverState = "" | "show" | "out" | null;

/** Util.getUID */
function getUID(prefix: string) {
  let id = prefix;
  do {
    id = prefix + Math.floor(Math.random() * MAX_UID);
  } while (document.getElementById(id));
  return id;
}

/** `$(tip).one(Util.TRANSITION_END, callback).emulateTransitionEnd(duration)` */
function onceTransitionEnd(element: HTMLElement, duration: number, callback: () => void) {
  let called = false;
  const done = (event?: Event) => {
    // bsTransitionEnd only handles events of the element itself.
    if (called || (event && event.target !== element)) return;
    called = true;
    element.removeEventListener("transitionend", done);
    window.clearTimeout(timer);
    callback();
  };
  element.addEventListener("transitionend", done);
  const timer = window.setTimeout(done, duration);
}

/**
 * jQuery's mouseenter/mouseleave: bound to mouseover/mouseout, ignoring moves
 * between the element and its children. The mouseover listener also makes the
 * element "clickable" for iOS like on live.
 */
function isEnterOrLeave(element: HTMLElement, event: MouseEvent) {
  const related = event.relatedTarget as Node | null;
  return !related || (related !== element && !element.contains(related));
}

const noop = () => {};

export class Tooltip {
  private readonly placement: Popper.Placement;
  private tip: HTMLElement | null = null;
  private popper: Popper | null = null;
  private timeout = 0;
  private hoverState: HoverState = "";
  private activeTrigger = { focus: false, hover: false };
  /** config.animation; _fixTransition() turns it off for one hide/show. */
  private animation = true;
  private readonly listeners: Array<[string, EventListener]>;

  constructor(private readonly element: HTMLElement) {
    this.placement = (element.getAttribute("data-placement") as Popper.Placement) || "top";
    this.listeners = [
      ["mouseover", (event) => isEnterOrLeave(element, event as MouseEvent) && this.enter("hover")],
      ["mouseout", (event) => isEnterOrLeave(element, event as MouseEvent) && this.leave("hover")],
      ["focusin", () => this.enter("focus")],
      ["focusout", () => this.leave("focus")],
    ];
    for (const [type, listener] of this.listeners) element.addEventListener(type, listener);
  }

  /** Leaving the page removes listeners and a visible tip (no hash router keeps it). */
  dispose() {
    window.clearTimeout(this.timeout);
    for (const [type, listener] of this.listeners) this.element.removeEventListener(type, listener);
    this.tip?.remove();
    this.popper?.destroy();
    this.popper = null;
    this.tip = null;
  }

  private getTitle() {
    return this.element.getAttribute("data-original-title") ?? "";
  }

  private getTipElement() {
    if (!this.tip) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = TEMPLATE;
      this.tip = wrapper.firstElementChild as HTMLElement;
    }
    return this.tip;
  }

  private addAttachmentClass(attachment: string) {
    this.getTipElement().classList.add(`${CLASS_PREFIX}-${attachment}`);
  }

  private cleanTipClass() {
    const tip = this.getTipElement();
    for (const name of Array.from(tip.classList)) {
      if (name.startsWith(CLASS_PREFIX)) tip.classList.remove(name);
    }
  }

  private handlePopperPlacementChange(data: Popper.Data) {
    this.cleanTipClass();
    this.addAttachmentClass(data.placement);
  }

  /** Mouse events on <body>'s children for iOS, as long as a tip is shown. */
  private toggleTouchListeners(add: boolean) {
    if (!("ontouchstart" in document.documentElement)) return;
    for (const child of Array.from(document.body.children)) {
      if (add) child.addEventListener("mouseover", noop);
      else child.removeEventListener("mouseover", noop);
    }
  }

  show() {
    if (!this.getTitle()) return;
    if (!document.documentElement.contains(this.element)) return;

    const tip = this.getTipElement();
    const tipId = getUID("tooltip");
    tip.setAttribute("id", tipId);
    this.element.setAttribute("aria-describedby", tipId);
    // setContent()
    (tip.querySelector(".tooltip-inner") as HTMLElement).textContent = this.getTitle();
    tip.classList.remove("fade", "show");

    if (this.animation) tip.classList.add("fade");
    this.addAttachmentClass(this.placement);
    if (!document.documentElement.contains(tip)) document.body.appendChild(tip);

    this.popper = new Popper(this.element, tip, {
      placement: this.placement,
      modifiers: {
        offset: { offset: 0 },
        flip: { behavior: "flip" },
        arrow: { element: ".arrow" },
        preventOverflow: { boundariesElement: "scrollParent" },
      },
      onCreate: (data) => {
        if (data.originalPlacement !== data.placement) this.handlePopperPlacementChange(data);
      },
      onUpdate: (data) => this.handlePopperPlacementChange(data),
    });

    tip.classList.add("show");
    this.toggleTouchListeners(true);

    const complete = () => {
      if (this.animation) this.fixTransition();
      const prevHoverState = this.hoverState;
      this.hoverState = null;
      if (prevHoverState === "out") this.leave(null);
    };
    if (tip.classList.contains("fade")) onceTransitionEnd(tip, TRANSITION_DURATION, complete);
    else complete();
  }

  hide() {
    const tip = this.getTipElement();
    const complete = () => {
      if (this.hoverState !== "show" && tip.parentNode) tip.parentNode.removeChild(tip);
      this.cleanTipClass();
      this.element.removeAttribute("aria-describedby");
      this.popper?.destroy();
    };

    tip.classList.remove("show");
    this.toggleTouchListeners(false);
    this.activeTrigger = { focus: false, hover: false };

    if (tip.classList.contains("fade")) onceTransitionEnd(tip, TRANSITION_DURATION, complete);
    else complete();
    this.hoverState = "";
  }

  /** Tooltip._fixTransition: only when Popper has not placed the tip yet. */
  private fixTransition() {
    const tip = this.getTipElement();
    if (tip.getAttribute("x-placement") !== null) return;
    tip.classList.remove("fade");
    this.animation = false;
    this.hide();
    this.show();
    this.animation = true;
  }

  private enter(trigger: "focus" | "hover") {
    this.activeTrigger[trigger] = true;
    if (this.getTipElement().classList.contains("show") || this.hoverState === "show") {
      this.hoverState = "show";
      return;
    }
    window.clearTimeout(this.timeout);
    this.hoverState = "show";
    this.show();
  }

  private leave(trigger: "focus" | "hover" | null) {
    if (trigger) this.activeTrigger[trigger] = false;
    if (this.activeTrigger.focus || this.activeTrigger.hover) return;
    window.clearTimeout(this.timeout);
    this.hoverState = "out";
    this.hide();
  }
}
