import { getTeam } from "@/lib/content";
import { asset } from "@/lib/base-path";
import { TeamMember } from "./TeamMember";

/** `${team}` of default_about.tpl: one card per member of content/team/team.yaml. */
export async function Team() {
  const { members } = await getTeam();
  return members.map((member) => <TeamMember key={member.name} member={member} />);
}

/** icon.tpl of default_about ("Unsere Philosophie"). */
export function ServicesIcon({
  icon,
  text,
  subtext,
}: {
  /** Name of /files/images/<icon>@3x.png. */
  icon: string;
  text: string;
  subtext: string;
}) {
  return (
    <div className="col-md-4 services-icon">
      <div className="services-icon-info" style={{ textAlign: "center" }}>
        <img src={asset(`/files/images/${icon}@3x.png`)} alt="" style={{ width: "80px" }} />
      </div>
      <div className="services-icon-text">
        <h4>
          <strong>{text}</strong>
        </h4>
        <h6 style={{ paddingTop: "5px" }}>{subtext}</h6>
      </div>
      <br />
      <br />
      <br />
    </div>
  );
}
