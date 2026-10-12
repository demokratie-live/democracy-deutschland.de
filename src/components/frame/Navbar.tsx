"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { asset } from "@/lib/base-path";
import { findRoute } from "@/lib/routes";
import type { Navigation, Route } from "@/lib/schemas";

/** Bootstrap 4.0.0 Collapse: emulateTransitionEnd fallback. */
const TRANSITION_DURATION = 600;

type Phase = "hidden" | "showing" | "shown" | "hiding";

const COLLAPSE_CLASS: Record<Phase, string> = {
  hidden: "collapse navbar-collapse",
  showing: "navbar-collapse collapsing",
  shown: "navbar-collapse collapse show",
  hiding: "navbar-collapse collapsing",
};

/**
 * Navbar of default_page.tpl. Replaces default_page.js (class "scrolled",
 * closing the menu on link click), the Bootstrap collapse plugin and the
 * navbar part of every init_<state>() (active item, class "startpage").
 */
export function Navbar({ navigation, routes }: { navigation: Navigation; routes: Route[] }) {
  const route = findRoute(routes, usePathname());
  const [scrolled, setScrolled] = useState(false);
  const [phase, setPhase] = useState<Phase>("hidden");
  // Bootstrap only adds "collapsed" to the toggler after the first hide.
  const [togglerCollapsed, setTogglerCollapsed] = useState(false);
  const collapseRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // $(document).scroll(() => $nav.toggleClass('scrolled', scrollTop > 0))
  // The class is also toggled synchronously like jQuery: init_home() reads the
  // navbar height right after scrolling.
  useEffect(() => {
    const onScroll = () => {
      const isScrolled = window.scrollY > 0;
      navRef.current?.classList.toggle("scrolled", isScrolled);
      setScrolled(isScrolled);
    };
    document.addEventListener("scroll", onScroll);
    return () => document.removeEventListener("scroll", onScroll);
  }, []);

  // Height transition of Collapse.show()/hide(); the classes come from `phase`.
  useLayoutEffect(() => {
    const element = collapseRef.current;
    if (!element || (phase !== "showing" && phase !== "hiding")) return;

    if (phase === "showing") {
      element.style.height = "0px";
      element.style.height = `${element.scrollHeight}px`;
    } else {
      element.style.height = "";
    }

    let finished = false;
    const complete = () => {
      if (finished) return;
      finished = true;
      element.style.height = "";
      setPhase(phase === "showing" ? "shown" : "hidden");
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === element) complete();
    };
    element.addEventListener("transitionend", onTransitionEnd);
    const timeout = window.setTimeout(complete, TRANSITION_DURATION);
    return () => {
      element.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(timeout);
    };
  }, [phase]);

  const show = () => {
    if (phase !== "hidden") return;
    setTogglerCollapsed(false);
    setPhase("showing");
  };

  const hide = () => {
    const element = collapseRef.current;
    if (phase !== "shown" || !element) return;
    element.style.height = `${element.getBoundingClientRect().height}px`;
    void element.offsetHeight; // Util.reflow
    setTogglerCollapsed(true);
    setPhase("hiding");
  };

  const expanded = phase === "showing" || phase === "shown";
  const navClass = [
    "navbar navbar-expand-lg navbar-light fixed-top",
    route?.startpage ? "startpage" : "",
    scrolled ? "scrolled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { brand, items } = navigation;

  return (
    <nav className={navClass} ref={navRef}>
      <div className="container">
        <Link className="navbar-brand" href={brand.href} prefetch={false}>
          <img src={asset(brand.logo)} alt={brand.alt} />
          {"\u00a0\u00a0"}
          {brand.name}
          <h3 id="navbar-brand-suffix">{brand.suffix}</h3>
        </Link>
        <button
          className={togglerCollapsed ? "navbar-toggler collapsed" : "navbar-toggler"}
          type="button"
          data-toggle="collapse"
          data-target="#navbar-collapse"
          aria-controls="navbar-collapse"
          aria-expanded={expanded}
          aria-label="Toggle navigation"
          onClick={() => (expanded ? hide() : show())}
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={COLLAPSE_CLASS[phase]} id="navbar-collapse" ref={collapseRef}>
          <ul className="navbar-nav">
            {items.map((item) => (
              <li
                key={item.id}
                className={route?.menu === item.id ? "nav-item active" : "nav-item"}
              >
                <Link
                  id={`menu_${item.id}`}
                  className={item.important ? "nav-link menu-important" : "nav-link"}
                  href={item.href}
                  prefetch={false}
                  onClick={hide}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
