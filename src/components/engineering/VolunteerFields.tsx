"use client";

import { Fragment, useRef } from "react";
import { mailSubject, runChecks, sendForm, validateEmail } from "@/lib/forms";
import type { Forms } from "@/lib/schemas";
import { label } from "./BugReportFields";

/** Inlined at build time; unset = prefilled mailto (docs/server-funktionen.md). */
const ENDPOINT = process.env.NEXT_PUBLIC_VOLUNTEER_ENDPOINT;

/** Checkbox `vol-<id>`, sent as `check_<id>`. */
export interface VolunteerOption {
  id: string;
  label: string;
}

export interface VolunteerTexts {
  /** Placeholders; without the trailing "*" also the labels in the prefilled mail. */
  name: string;
  email: string;
  rolesHeading: string;
  roles: VolunteerOption[];
  featureHeading: string;
  feature: VolunteerOption;
  text: string;
  submit: string;
}

function Checkboxes({ options }: { options: VolunteerOption[] }) {
  return options.map((option) => (
    <Fragment key={option.id}>
      <input id={`vol-${option.id}`} type="checkbox" />
      {` ${option.label}`}
      <br />
    </Fragment>
  ));
}

/**
 * `<form id="vol-form">` of default_engineering.tpl with the click handler of
 * init_engineering(): checks name, email and text (alert, then focus), then
 * sends like sendMail(). In the prefilled mail each checkbox group is one
 * line "<heading>: <checked labels>".
 */
export function VolunteerFields({ texts, forms }: { texts: VolunteerTexts; forms: Forms }) {
  const form = useRef<HTMLFormElement>(null);

  const send = async () => {
    const element = (id: string) => form.current?.querySelector(`#${id}`) as HTMLInputElement;
    const checked = (option: VolunteerOption) =>
      element(`vol-${option.id}`).checked ? true : null;
    const options = [...texts.roles, texts.feature];
    const data = {
      type: "volunteer",
      name: element("vol-name").value,
      email: element("vol-email").value,
      ...Object.fromEntries(options.map((option) => [`check_${option.id}`, checked(option)])),
      text: element("vol-text").value,
    };
    const { messages } = forms;
    const valid = runChecks([
      { id: "vol-name", valid: data.name.length >= 3, message: messages.firstName },
      { id: "vol-email", valid: validateEmail(data.email), message: messages.email },
      { id: "vol-text", valid: data.text.length >= 3, message: messages.text },
    ]);
    if (!valid) return;

    const checkedLabels = (group: VolunteerOption[]) =>
      group
        .filter((option) => checked(option))
        .map((option) => option.label)
        .join(", ") || "–";
    const result = await sendForm({
      endpoint: ENDPOINT,
      data,
      mail: {
        to: forms.recipient,
        subject: mailSubject(forms.subject, data.type),
        fields: [
          [label(texts.name), data.name],
          [label(texts.email), data.email],
          [texts.rolesHeading, checkedLabels(texts.roles)],
          [texts.featureHeading, checkedLabels([texts.feature])],
        ],
        text: data.text,
      },
    });
    if (result === "sent") {
      form.current?.reset();
      window.alert(messages.sent);
    } else if (result === "failed") {
      window.alert(messages.failed);
    }
  };

  return (
    <form id="vol-form" ref={form}>
      <div className="row" id="laptop">
        <div
          className="col-lg-6"
          style={{ backgroundColor: "#fff", paddingTop: "35px", verticalAlign: "top" }}
        >
          <input
            id="vol-name"
            type="text"
            placeholder={texts.name}
            style={{ width: "100%", marginTop: 0 }}
          />{" "}
          <input id="vol-email" type="email" placeholder={texts.email} style={{ width: "100%" }} />
          <br />
          <br />
          <h5>{texts.rolesHeading}</h5>
          <Checkboxes options={texts.roles} />
          <br />
          <h5>{texts.featureHeading}</h5>
          <Checkboxes options={[texts.feature]} />
        </div>
        <div className="col-lg-6" id="finalblock">
          <textarea
            id="vol-text"
            placeholder={texts.text}
            style={{ width: "100%", minHeight: "400px" }}
          ></textarea>
          <a className="btn-democracy" id="vol-send" onClick={send}>
            <div style={{ border: 0 }}>{texts.submit}</div>
          </a>
        </div>
      </div>
    </form>
  );
}
