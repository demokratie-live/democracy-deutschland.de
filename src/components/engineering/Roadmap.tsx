import { getRoadmap } from "@/lib/content";
import { iconClass } from "@/lib/roadmap";
import type { RoadmapGoal } from "@/lib/schemas";

const COLUMNS = ["beta", "mvp", "dream"] as const;
const NBSP = " ";

/** Goal text of goal.tpl: `${goal}&nbsp;`, sub items start with three &nbsp;. */
function GoalText({ goal }: { goal: RoadmapGoal }) {
  const indent = goal.sub ? NBSP.repeat(3) : "";
  if (!goal.bold) return `${indent}${goal.goal}${NBSP}`;
  return (
    <>
      {indent}
      <b>{goal.goal}</b>
      {NBSP}
    </>
  );
}

/**
 * Roadmap table of default_engineering.tpl with one goal.tpl row per entry
 * of content/engineering/roadmap.yaml; icons from icon_class() (src/lib/roadmap.ts).
 */
export async function Roadmap({ heading }: { heading: string }) {
  const { columns, goals } = await getRoadmap();
  return (
    <table
      className="table table-striped table-bordered table-hover"
      style={{ marginTop: "50px", wordBreak: "break-all" }}
    >
      <thead>
        <tr>
          <th scope="col" style={{ fontSize: "20px", verticalAlign: "top" }}>
            {heading}
          </th>
          {COLUMNS.map((key) => (
            <th key={key} scope="col" className="rotate">
              {columns[key].text}
              <div className={`rmicon-${columns[key].color}`}>{columns[key].date}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {goals.map((goal, index) => (
          <tr key={index}>
            <td scope="row">
              <GoalText goal={goal} />
              <a
                href={`https://github.com/demokratie-live/democracy-client/issues/${goal.issue ?? ""}`}
                target="_blank"
              >
                {goal.issue ? `#${goal.issue}` : ""}
              </a>
            </td>
            {COLUMNS.map((key) => (
              <td key={key}>
                <i className={`fa ${iconClass(goal[key])}`}></i>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
