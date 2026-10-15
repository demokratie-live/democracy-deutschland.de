"use client";

import { useState } from "react";

/**
 * Discord widget of default_about.tpl. Live loads the iframe with the page;
 * here a placeholder in the style of the team cards stands in its place until
 * the visitor clicks, then the original iframe is rendered
 * (docs/abweichungen.md). Texts are MDX props.
 */
export function DiscordWidget({
  server,
  title,
  text,
  button,
}: {
  /** Discord server id of the widget URL. */
  server: string;
  title: string;
  text: string;
  button: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        src={`https://discordapp.com/widget?id=${server}&theme=light`}
        width="100%"
        height="100%"
        // old attribute of the template, unknown to React's types; lowercase like live
        {...{ allowtransparency: "true" }}
        frameBorder="0"
        style={{ paddingBottom: "15px", minHeight: "30p0x" }}
      ></iframe>
    );
  }

  return (
    <div className="discord-placeholder" style={{ height: "100%", paddingBottom: "15px" }}>
      <div
        className="team_info"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "20px 15px",
        }}
      >
        <i
          className="fab fa-discord"
          aria-hidden="true"
          style={{ color: "rgb(122, 122, 122)", fontSize: "56px" }}
        ></i>
        <h4>{title}</h4>
        <p className="team_text">{text}</p>
        <a
          href="#"
          className="btn-democracy"
          role="button"
          onClick={(event) => {
            event.preventDefault();
            setLoaded(true);
          }}
        >
          <div>{button}</div>
        </a>
      </div>
    </div>
  );
}
