import type { ReactNode } from "react";
import { getDonation } from "@/lib/content";
import { itemPercentage, percentage, phpNumberFormat, sortedItems } from "@/lib/donation";
import { DONATION_TYPE_HEAD, type Donation } from "@/lib/schemas/donation";
import { asset } from "@/lib/base-path";
import { UpdateProgress } from "./UpdateProgress";

/**
 * Values for the `{placeholder}`s in the MDX texts, formatted like
 * default_donate::donate_box()/donate_details(): goals and value with
 * number_format(), the number of sponsors (`paten`) unformatted.
 */
function figures(donation: Donation): Record<string, string> {
  return {
    percentage: String(percentage(donation.donation_value, donation.donation_value_goal)),
    paten: String(donation.donation_paten),
    patenGoal: phpNumberFormat(donation.donation_paten_goal),
    value: phpNumberFormat(donation.donation_value),
    valueGoal: phpNumberFormat(donation.donation_value_goal),
    date: donation.donation_date,
  };
}

/** Replaces `{name}` in an MDX text with the donation figures. */
function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in values)) throw new Error(`Unbekannter Platzhalter ${match} in „${template}“`);
    return values[name];
  });
}

const WRAPPER = { width: "100%", marginLeft: "auto", marginRight: "auto" };
const BOX = {
  borderTop: "solid 3px #4494D3",
  marginTop: "5px",
  backgroundColor: "#f6f6f6",
  textAlign: "center",
} as const;
const NOTE = { display: "block", fontWeight: "normal", color: "#6a666b" } as const;

/** `<progress>` with the label drawn by `progress:before` (default_donate.css). */
function Progress({ value, label }: { value: string; label: string }) {
  return <progress max="100" value={value} data-label={label}></progress>;
}

/** donate_box.tpl: sponsorships and monthly donations next to the intro text. */
export async function DonateBox({
  progress,
  paten,
  patenNote,
  value,
  valueNote,
  date,
  logoAlt,
}: {
  progress: string;
  paten: string;
  patenNote: string;
  value: string;
  valueNote: string;
  date: string;
  logoAlt: string;
}) {
  const values = figures(await getDonation());
  return (
    <div style={WRAPPER}>
      <Progress value={values.percentage} label={fill(progress, values)} />
      <div style={BOX}>
        <span style={{ display: "block", fontWeight: "bold", paddingTop: "20px" }}>
          <span style={{ fontSize: "x-large", color: "#333" }}>{fill(paten, values)}</span>
        </span>
        <span style={{ ...NOTE, fontSize: "large", paddingBottom: "15px" }}>{patenNote}</span>
        <hr />
        <span style={{ display: "block", fontWeight: "bold", paddingTop: "15px" }}>
          <span style={{ fontSize: "larger", color: "#333" }}>{fill(value, values)}</span>
        </span>
        <span style={{ ...NOTE, fontSize: "medium" }}>{valueNote}</span>
        <span style={{ ...NOTE, fontSize: "small" }}>{fill(date, values)}</span>
        <img
          style={{ padding: "35px", height: "200px" }}
          src={asset("/files/images/Bubble.png")}
          alt={logoAlt}
        />
      </div>
    </div>
  );
}

/**
 * donate_details.tpl: progress, monthly donations and the table of costs with
 * a bar per row. `children` follow the table (donate button and modal).
 */
export async function DonateDetails({
  progress,
  value,
  valueNote,
  children,
}: {
  progress: string;
  value: string;
  valueNote: string;
  children: ReactNode;
}) {
  const donation = await getDonation();
  const values = figures(donation);
  return (
    <div style={WRAPPER}>
      <Progress value={values.percentage} label={fill(progress, values)} />
      <div style={{ ...BOX, paddingBottom: "15px", paddingTop: "15px" }}>
        <span style={{ display: "block", fontWeight: "bold" }}>
          <span style={{ fontSize: "larger", color: "#333" }}>{fill(value, values)}</span>
        </span>
        <span style={{ ...NOTE, fontSize: "medium" }}>{valueNote}</span>
      </div>
      <table className="donate-details">
        <tbody className="table-body">
          {sortedItems(donation).map((item) =>
            item.type === DONATION_TYPE_HEAD ? (
              <tr key={item.id} className="donate-details-head">
                <th></th>
                <th>{item.text_description}</th>
                <th></th>
              </tr>
            ) : (
              <tr key={item.id} className="donate-details-data">
                <td>
                  <div
                    className="donate-detail-progress"
                    style={{ width: `${itemPercentage(item)}%` }}
                  ></div>
                  <div className="donate-details-cost-text">{item.text_cost}</div>
                  <div className="donate-details-cost">{phpNumberFormat(item.max)}€</div>
                </td>
                <td>
                  <div className="donate-details-description">{item.text_description}</div>
                  <div className="donate-details-description-subtext">
                    {item.text_description_subtext}
                  </div>
                </td>
                <td>
                  <div className="donate-details-date">{item.text_date}</div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {children}
      <UpdateProgress />
    </div>
  );
}
