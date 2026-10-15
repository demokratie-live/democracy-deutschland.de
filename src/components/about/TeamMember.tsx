"use client";

import { Fragment, useState } from "react";
import { asset } from "@/lib/base-path";
import type { TeamMember as Member } from "@/lib/schemas/team";

/**
 * team_member.tpl with the hover handler of init_about(): while the mouse is
 * over the card, the contact links replace the text (jQuery show()/hide()
 * leave `display: block` / `display: none` inline) and the photo switches to
 * `imgHover` if there is one.
 */
export function TeamMember({ member }: { member: Member }) {
  const [hover, setHover] = useState(false);
  const src = hover && member.imgHover ? member.imgHover : member.img;

  return (
    <div
      className="col-md-3 team_div"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div>
        <img src={asset(src)} alt={member.name} className="img-responsive" />
      </div>
      <div className="team_info">
        <h4>{member.name}</h4>
        <div className="team_links" style={hover ? { display: "block" } : undefined}>
          {member.links.map((link) => (
            // Template newlines around the icon render as spaces inside the link.
            <a key={link.url} href={link.url} className="team_link" target="_blank">
              {" "}
              <i className={link.icon} aria-hidden="true"></i>{" "}
            </a>
          ))}
        </div>
        <p className="team_text" style={hover ? { display: "none" } : undefined}>
          {member.text.map((line, index) => (
            <Fragment key={index}>
              {index > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </p>
      </div>
    </div>
  );
}
