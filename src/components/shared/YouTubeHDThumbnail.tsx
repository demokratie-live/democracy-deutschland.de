"use client";

import { useState } from "react";
import { asset } from "@/lib/base-path";

/**
 * Port of the jQuery plugin jQuery.YouTube.HD.Thumbnail_democracy.js
 * (demokratie-live/YouTubeHDThumbnail): shows maxresdefault.jpg with the play
 * button of the plugin CSS (public/vendor/YouTubeHDThumbnail/) and starts the
 * video on click. Unlike live, nothing is loaded from YouTube before the
 * click: the thumbnail is a local copy (public/files/youtube/<id>.jpg) and the
 * iframe (youtube-nocookie.com) is only rendered after the click
 * (docs/abweichungen.md).
 */
export function YouTubeHDThumbnail({ videoId }: { videoId: string }) {
  const [clicked, setClicked] = useState(false);

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
          <img alt="" src={asset(`/files/youtube/${videoId}.jpg`)} />
        </a>
        {clicked && (
          <iframe
            width="100%"
            height="100%"
            className="yt-hd-thumbnail"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        )}
      </div>
    </div>
  );
}
