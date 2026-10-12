"use client";

import { useState } from "react";

/**
 * Port of the jQuery plugin jQuery.YouTube.HD.Thumbnail_democracy.js
 * (demokratie-live/YouTubeHDThumbnail): shows maxresdefault.jpg over the
 * hidden iframe and starts the video on click. The CSS still comes from
 * jsdelivr (content/site/head.yaml).
 */
export function YouTubeHDThumbnail({ src }: { src: string }) {
  const [clicked, setClicked] = useState(false);
  const videoId = src.split("?")[0].split("/").pop();

  return (
    <div className="yt-hd-thumbnail-outer-container" style={{ width: "100%" }}>
      <div
        className={
          clicked
            ? "yt-hd-thumbnail-inner-container yt-hd-thumbnail-clicked"
            : "yt-hd-thumbnail-inner-container"
        }
      >
        <a
          href="#"
          className="yt-hd-thumbnail"
          onClick={(event) => {
            event.preventDefault();
            setClicked(true);
          }}
        >
          <img alt="" src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`} />
        </a>
        <iframe
          width="100%"
          height="100%"
          className="yt-hd-thumbnail"
          src={clicked ? `${src}?autoplay=1` : src}
          frameBorder="0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}
