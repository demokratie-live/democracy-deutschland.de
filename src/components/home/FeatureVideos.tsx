"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { animateScrollTo, offsetTop } from "@/lib/animate";
import { asset } from "@/lib/base-path";

interface InfoBadgeProps {
  /** Image name in /files/images: "<icon>@3x.png" (passive), "<icon>@3x.t.png" (active) */
  icon: string;
  /** MP4 path, e.g. /videos/DDW-List_croped.mp4 (also used as data-webm, like live) */
  video: string;
  /** Bold verb at the start, e.g. "Wähle" */
  action: string;
  text: string;
}

/** Declarative child of <FeatureVideos>; rendered by FeatureVideos itself. */
export function InfoBadge(props: InfoBadgeProps) {
  void props;
  return null;
}

/** jQuery `.height()`: content height without padding and border. */
function contentHeight(element: Element) {
  const style = getComputedStyle(element);
  return (
    element.getBoundingClientRect().height -
    parseFloat(style.paddingTop) -
    parseFloat(style.paddingBottom) -
    parseFloat(style.borderTopWidth) -
    parseFloat(style.borderBottomWidth)
  );
}

/**
 * "Alle Funktionen von DEMOCRACY" (default_home.tpl): clicking an info badge
 * activates it, swaps the phone video and scrolls to the video (init_home()).
 */
export function FeatureVideos({
  heading,
  webm,
  children,
}: {
  heading: string;
  /** Initial src of <source id="video-webm"> (never played, kept from the original). */
  webm: string;
  children: ReactNode;
}) {
  const badges = Children.toArray(children)
    .filter((child): child is ReactElement<InfoBadgeProps> => isValidElement(child))
    .map((child) => child.props);

  const [active, setActive] = useState(0);
  // Before the first click the icons are toggled by the class "hidden"; after
  // it jQuery's show()/hide() leave inline display styles.
  const [clicked, setClicked] = useState(false);
  const [sources, setSources] = useState({ mp4: asset(badges[0]?.video ?? ""), webm });
  const videoRef = useRef<HTMLVideoElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (firstRender.current) {
      // React does not render the muted attribute on the server.
      firstRender.current = false;
      video.muted = true;
      video.play().catch(() => {});
      return;
    }
    video.load();
    video.play().catch(() => {});
  }, [sources]);

  const select = (index: number) => {
    videoRef.current?.pause();
    setActive(index);
    setClicked(true);
    const mp4 = asset(badges[index].video);
    setSources({ mp4, webm: mp4 });

    const target = document.getElementById("device-explain");
    const navbar = document.querySelector(".navbar");
    if (target && navbar) animateScrollTo(offsetTop(target) - contentHeight(navbar) - 50, 750);
  };

  return (
    <div className="row">
      <div className="col-lg-7 order-lg-1 about-content">
        <h1>{heading}</h1>
        {badges.map((badge, index) => {
          const isActive = index === active;
          const initial = index === 0;
          return (
            <div
              key={badge.icon}
              className={isActive ? "info-badge active" : "info-badge"}
              data-mp4={asset(badge.video)}
              data-webm={asset(badge.video)}
              onClick={() => select(index)}
            >
              <div className="info-icon">
                <img
                  alt=""
                  className={initial ? "info-icon-passive hidden" : "info-icon-passive"}
                  src={asset(`/files/images/${badge.icon}@3x.png`)}
                  style={clicked ? { display: isActive ? "none" : "inline" } : undefined}
                />
                <img
                  alt=""
                  className={initial ? "info-icon-active" : "info-icon-active hidden"}
                  src={asset(`/files/images/${badge.icon}@3x.t.png`)}
                  style={clicked ? { display: isActive ? "inline" : "none" } : undefined}
                />
              </div>
              <div className="info-content">
                <b>{badge.action}</b> {badge.text}
              </div>
            </div>
          );
        })}
        <br />
        <br />
      </div>
      <div className="col-lg-5 order-lg-12">
        <div className="device-container" id="device-explain">
          <video id="video" ref={videoRef} autoPlay loop muted playsInline>
            <source id="video-mp4" src={sources.mp4} type="video/mp4" />
            <source id="video-webm" src={sources.webm} type="video/webm" />
            <Fragment>Your browser does not support HTML5 video.</Fragment>
          </video>
        </div>
      </div>
    </div>
  );
}
