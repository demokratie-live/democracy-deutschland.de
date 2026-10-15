"use client";

import { useEffect, useRef, useState } from "react";
import { slide, type Tween } from "@/lib/animate";
import { useBlogSearchQuery } from "@/lib/blog/search-query";

interface BlogHeaderProps {
  title: string;
  /** Blog home (basePath applied). */
  home: string;
  /** The blog home shows the blog title as <h1>, other pages (and a search) as <div>. */
  titleTag: "h1" | "div";
}

function isHidden(element: HTMLElement) {
  return getComputedStyle(element).display === "none";
}

/**
 * header.php of Lovecraft: blog title, toggles for the mobile menu and the
 * mobile search (global.js: slideToggle, closing the other one, both reset
 * above 1000 px) and the navigation bar with the empty menus of the blog.
 */
export function BlogHeader({ title, home, titleTag }: BlogHeaderProps) {
  const Title = useBlogSearchQuery() === null ? titleTag : "div";
  const menu = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLDivElement>(null);
  const tweens = useRef(new Map<HTMLElement, Tween>());
  const [navActive, setNavActive] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  const slideToggle = (element: HTMLElement | null) => {
    if (!element) return;
    tweens.current.get(element)?.stop();
    tweens.current.set(element, slide(element, isHidden(element)));
  };

  const toggleNav = () => {
    setNavActive(!navActive);
    slideToggle(menu.current);
    if (searchActive) {
      setSearchActive(false);
      slideToggle(search.current);
    }
  };

  const toggleSearch = () => {
    setSearchActive(!searchActive);
    slideToggle(search.current);
    if (navActive) {
      setNavActive(false);
      slideToggle(menu.current);
    }
  };

  useEffect(() => {
    const running = tweens.current;
    const onResize = () => {
      if (document.documentElement.clientWidth <= 1000) return;
      setNavActive(false);
      setSearchActive(false);
      for (const element of [menu.current, search.current]) {
        if (!element) continue;
        running.get(element)?.stop();
        element.style.display = "none";
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      running.forEach((tween) => tween.stop());
    };
  }, []);

  return (
    <>
      <header className="header-wrapper">
        <div className="header section bg-white small-padding">
          <div className="section-inner group">
            <Title className="blog-title">
              <a href={home} rel="home">
                {title}
              </a>
            </Title>
          </div>
        </div>
        <div className="toggles group">
          <button
            type="button"
            className={navActive ? "nav-toggle toggle active" : "nav-toggle toggle"}
            onClick={toggleNav}
          >
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <span className="screen-reader-text">Mobil-Menü umschalten</span>
          </button>{" "}
          <button
            type="button"
            className={searchActive ? "search-toggle toggle active" : "search-toggle toggle"}
            onClick={toggleSearch}
          >
            <div className="genericon genericon-search"></div>
            <span className="screen-reader-text">Suchfeld umschalten</span>
          </button>
        </div>
      </header>
      <div className="navigation bg-white no-padding">
        <div className="section-inner group">
          <ul className="mobile-menu" ref={menu}></ul>
          <div className="mobile-search" ref={search}>
            <form method="get" className="search-form" id="search-form-1" action={home}>
              <input
                type="search"
                className="search-field"
                placeholder="Suchformular"
                name="s"
                id="s-1"
              />{" "}
              <button type="submit" className="search-button">
                <div className="genericon genericon-search"></div>
                <span className="screen-reader-text">Suchen</span>
              </button>
            </form>
          </div>
          <ul className="main-menu"></ul>
        </div>
      </div>
    </>
  );
}
