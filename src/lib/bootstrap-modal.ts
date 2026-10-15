/**
 * Bootstrap 4.0.0 Modal plugin (bootstrap.js "Modal" and its data API) without
 * jQuery. The modal markup is server-rendered like the original template; as
 * with `$(target).modal()`, an instance is created on the first click of a
 * trigger and works directly on the DOM: classes, inline styles, the backdrop
 * on <body>, focus handling and the scrollbar compensation of fixed elements.
 */

const TRANSITION_DURATION = 300;
const BACKDROP_TRANSITION_DURATION = 150;
const ESCAPE_KEY = "Escape";
const FIXED_CONTENT = ".fixed-top, .fixed-bottom, .is-fixed, .sticky-top";
const STICKY_CONTENT = ".sticky-top";
const NAVBAR_TOGGLER = ".navbar-toggler";

type Cleanup = () => void;

/** Util.reflow */
const reflow = (element: HTMLElement) => void element.offsetHeight;

/**
 * `$(element).one(Util.TRANSITION_END, callback).emulateTransitionEnd(duration)`:
 * the first transitionend on the element or a descendant (jQuery sees bubbled
 * events too), or the timeout as fallback.
 */
function onceTransitionEnd(element: HTMLElement, duration: number, callback: () => void) {
  let called = false;
  const done = () => {
    if (called) return;
    called = true;
    element.removeEventListener("transitionend", done);
    window.clearTimeout(timer);
    callback();
  };
  element.addEventListener("transitionend", done);
  const timer = window.setTimeout(done, duration);
}

/** jQuery `:visible` */
const isVisible = (element: HTMLElement) =>
  element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;

class Modal {
  private readonly dialog: HTMLElement | null;
  private backdrop: HTMLElement | null = null;
  private isShown = false;
  private isTransitioning = false;
  private isBodyOverflowing = false;
  private ignoreBackdropClick = false;
  private scrollbarWidth = 0;
  /** Inline values replaced by _setScrollbar(), restored by _resetScrollbar(). */
  private readonly savedPadding = new Map<HTMLElement, string>();
  private readonly savedMargin = new Map<HTMLElement, string>();
  /** Listeners Bootstrap binds on show and unbinds on hide (".bs.modal" namespaces). */
  private keydown: Cleanup | null = null;
  private resize: Cleanup | null = null;
  private focusin: Cleanup | null = null;
  private clickDismiss: Cleanup[] = [];
  private mousedownDismiss: Cleanup | null = null;
  private relatedTarget: HTMLElement | null = null;

  constructor(private readonly element: HTMLElement) {
    this.dialog = element.querySelector<HTMLElement>(".modal-dialog");
  }

  toggle(relatedTarget: HTMLElement) {
    if (this.isShown) this.hide();
    else this.show(relatedTarget);
  }

  show(relatedTarget: HTMLElement) {
    if (this.isTransitioning || this.isShown) return;
    if (this.element.classList.contains("fade")) this.isTransitioning = true;
    // Data API: focus the trigger again once the modal is hidden.
    this.relatedTarget = relatedTarget;
    this.isShown = true;

    this.checkScrollbar();
    this.setScrollbar();
    this.adjustDialog();
    document.body.classList.add("modal-open");
    this.setEscapeEvent();
    this.setResizeEvent();

    this.listen(this.clickDismiss, this.element, "click", (event) => {
      const dismiss = (event.target as Element).closest('[data-dismiss="modal"]');
      if (dismiss && this.element.contains(dismiss)) {
        event.preventDefault();
        this.hide();
      }
    });
    if (this.dialog) {
      const dialog = this.dialog;
      const onMousedown = () => {
        const onMouseup = (event: Event) => {
          this.element.removeEventListener("mouseup", onMouseup);
          if (event.target === this.element) this.ignoreBackdropClick = true;
        };
        this.element.addEventListener("mouseup", onMouseup);
      };
      dialog.addEventListener("mousedown", onMousedown);
      this.mousedownDismiss = () => dialog.removeEventListener("mousedown", onMousedown);
    }

    this.showBackdrop(() => this.showElement());
  }

  hide() {
    if (this.isTransitioning || !this.isShown) return;
    this.isShown = false;
    const transition = this.element.classList.contains("fade");
    if (transition) this.isTransitioning = true;

    this.setEscapeEvent();
    this.setResizeEvent();
    this.focusin?.();
    this.focusin = null;
    this.element.classList.remove("show");
    this.clickDismiss.forEach((off) => off());
    this.clickDismiss = [];
    this.mousedownDismiss?.();
    this.mousedownDismiss = null;

    if (transition) onceTransitionEnd(this.element, TRANSITION_DURATION, () => this.hideModal());
    else this.hideModal();
  }

  /** Not in Bootstrap: undo everything on <body> when React unmounts the page. */
  dispose() {
    this.keydown?.();
    this.resize?.();
    this.focusin?.();
    this.clickDismiss.forEach((off) => off());
    this.mousedownDismiss?.();
    this.backdrop?.remove();
    this.backdrop = null;
    if (this.isShown || this.isTransitioning) {
      document.body.classList.remove("modal-open");
      this.resetScrollbar();
    }
  }

  private listen(
    list: Cleanup[],
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
  ) {
    target.addEventListener(type, handler);
    list.push(() => target.removeEventListener(type, handler));
  }

  private showElement() {
    const transition = this.element.classList.contains("fade");
    this.element.style.display = "block";
    this.element.removeAttribute("aria-hidden");
    this.element.scrollTop = 0;
    if (transition) reflow(this.element);
    this.element.classList.add("show");
    this.enforceFocus();

    const transitionComplete = () => {
      this.element.focus();
      this.isTransitioning = false;
    };
    if (transition && this.dialog) {
      onceTransitionEnd(this.dialog, TRANSITION_DURATION, transitionComplete);
    } else {
      transitionComplete();
    }
  }

  private enforceFocus() {
    this.focusin?.();
    const onFocusin = (event: FocusEvent) => {
      const target = event.target as Node;
      if (target !== document && target !== this.element && !this.element.contains(target)) {
        this.element.focus();
      }
    };
    document.addEventListener("focusin", onFocusin);
    this.focusin = () => document.removeEventListener("focusin", onFocusin);
  }

  private setEscapeEvent() {
    if (this.isShown) {
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key === ESCAPE_KEY) {
          event.preventDefault();
          this.hide();
        }
      };
      this.element.addEventListener("keydown", onKeydown);
      this.keydown = () => this.element.removeEventListener("keydown", onKeydown);
    } else {
      this.keydown?.();
      this.keydown = null;
    }
  }

  private setResizeEvent() {
    if (this.isShown) {
      const onResize = () => this.adjustDialog();
      window.addEventListener("resize", onResize);
      this.resize = () => window.removeEventListener("resize", onResize);
    } else {
      this.resize?.();
      this.resize = null;
    }
  }

  private hideModal() {
    this.element.style.display = "none";
    this.element.setAttribute("aria-hidden", "true");
    this.isTransitioning = false;
    this.showBackdrop(() => {
      document.body.classList.remove("modal-open");
      this.resetAdjustments();
      this.resetScrollbar();
      // Data API: $target.one(HIDDEN, () => $(trigger).is(':visible') && trigger.focus())
      const trigger = this.relatedTarget;
      this.relatedTarget = null;
      if (trigger && isVisible(trigger)) trigger.focus();
    });
  }

  private showBackdrop(callback: () => void) {
    const animate = this.element.classList.contains("fade");
    if (this.isShown) {
      const backdrop = document.createElement("div");
      backdrop.className = animate ? "modal-backdrop fade" : "modal-backdrop";
      document.body.appendChild(backdrop);
      this.backdrop = backdrop;

      this.listen(this.clickDismiss, this.element, "click", (event) => {
        if (this.ignoreBackdropClick) {
          this.ignoreBackdropClick = false;
          return;
        }
        if (event.target !== event.currentTarget) return;
        this.hide();
      });

      if (animate) reflow(backdrop);
      backdrop.classList.add("show");
      if (animate) onceTransitionEnd(backdrop, BACKDROP_TRANSITION_DURATION, callback);
      else callback();
    } else if (this.backdrop) {
      const backdrop = this.backdrop;
      backdrop.classList.remove("show");
      const callbackRemove = () => {
        backdrop.remove();
        if (this.backdrop === backdrop) this.backdrop = null;
        callback();
      };
      if (animate) onceTransitionEnd(backdrop, BACKDROP_TRANSITION_DURATION, callbackRemove);
      else callbackRemove();
    } else {
      callback();
    }
  }

  // Overflowing modals and the scrollbar, as in Bootstrap 4.0.0.

  private adjustDialog() {
    const isModalOverflowing = this.element.scrollHeight > document.documentElement.clientHeight;
    if (!this.isBodyOverflowing && isModalOverflowing) {
      this.element.style.paddingLeft = `${this.scrollbarWidth}px`;
    }
    if (this.isBodyOverflowing && !isModalOverflowing) {
      this.element.style.paddingRight = `${this.scrollbarWidth}px`;
    }
  }

  private resetAdjustments() {
    this.element.style.paddingLeft = "";
    this.element.style.paddingRight = "";
  }

  private checkScrollbar() {
    const rect = document.body.getBoundingClientRect();
    this.isBodyOverflowing = rect.left + rect.right < window.innerWidth;
    this.scrollbarWidth = this.getScrollbarWidth();
  }

  private setScrollbar() {
    if (!this.isBodyOverflowing) return;
    const width = this.scrollbarWidth;
    const shift = (selector: string, prop: "paddingRight" | "marginRight", sign: 1 | -1) => {
      const saved = prop === "paddingRight" ? this.savedPadding : this.savedMargin;
      const cssProp = prop === "paddingRight" ? "padding-right" : "margin-right";
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        const calculated = parseFloat(getComputedStyle(element).getPropertyValue(cssProp));
        saved.set(element, element.style[prop]);
        element.style[prop] = `${calculated + sign * width}px`;
      });
    };
    shift(FIXED_CONTENT, "paddingRight", 1);
    shift(STICKY_CONTENT, "marginRight", -1);
    shift(NAVBAR_TOGGLER, "marginRight", 1);
    shift("body", "paddingRight", 1);
  }

  private resetScrollbar() {
    this.savedPadding.forEach((value, element) => (element.style.paddingRight = value));
    this.savedMargin.forEach((value, element) => (element.style.marginRight = value));
    this.savedPadding.clear();
    this.savedMargin.clear();
  }

  private getScrollbarWidth() {
    const scrollDiv = document.createElement("div");
    scrollDiv.className = "modal-scrollbar-measure";
    document.body.appendChild(scrollDiv);
    const width = scrollDiv.getBoundingClientRect().width - scrollDiv.clientWidth;
    document.body.removeChild(scrollDiv);
    return width;
  }
}

const instances = new WeakMap<HTMLElement, Modal>();

/**
 * Click on `[data-toggle="modal"][data-target=…]`: the first click creates the
 * instance and shows the modal, later clicks toggle it (Bootstrap data API).
 */
export function toggleModal(selector: string, trigger: HTMLElement) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;
  let modal = instances.get(element);
  if (!modal) {
    modal = new Modal(element);
    instances.set(element, modal);
    modal.show(trigger);
  } else {
    modal.toggle(trigger);
  }
}

/** Removes backdrop, body class and listeners of the modal, if it was ever opened. */
export function disposeModal(element: HTMLElement) {
  instances.get(element)?.dispose();
  instances.delete(element);
}
