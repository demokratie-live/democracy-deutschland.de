"use client";

import { useRef } from "react";
import { mailSubject, runChecks, sendForm, validateEmail } from "@/lib/forms";
import type { Forms } from "@/lib/schemas";

/** Inlined at build time; unset = prefilled mailto (docs/server-funktionen.md). */
const ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;

export interface ContactFormLabels {
  /** Placeholders, also the labels in the prefilled mail. */
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  submit: string;
}

/**
 * `<form id="form">` of default_contact.tpl with the click handler of
 * init_contact(): checks first name, last name, email and text in this order
 * (alert, then focus), then sends like sendMail(). With an endpoint the result
 * shows the old alerts (success also resets the form); the mailto opens the
 * mail program and leaves the form as it is (decision Manuel 2026-10-13).
 */
export function ContactFormFields({ labels, forms }: { labels: ContactFormLabels; forms: Forms }) {
  const form = useRef<HTMLFormElement>(null);

  const send = async () => {
    const value = (id: string) => (form.current?.elements.namedItem(id) as HTMLInputElement).value;
    const data = {
      type: "contact",
      vorname: value("vorname"),
      nachname: value("nachname"),
      email: value("email"),
      text: value("text"),
    };
    const { messages } = forms;
    const valid = runChecks([
      { id: "vorname", valid: data.vorname.length >= 3, message: messages.firstName },
      { id: "nachname", valid: data.nachname.length >= 3, message: messages.lastName },
      { id: "email", valid: validateEmail(data.email), message: messages.email },
      { id: "text", valid: data.text.length >= 3, message: messages.text },
    ]);
    if (!valid) return;

    const result = await sendForm({
      endpoint: ENDPOINT,
      data,
      mail: {
        to: forms.recipient,
        subject: mailSubject(forms.subject, data.type),
        fields: [
          [labels.firstName, data.vorname],
          [labels.lastName, data.nachname],
          [labels.email, data.email],
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
    <div className="col-md-12" style={{ textAlign: "left" }}>
      <form id="form" ref={form} style={{ marginTop: "50px" }}>
        <div className="row">
          <div className="col-md-4">
            <div className="form-group">
              <input
                id="vorname"
                type="text"
                className="form-control"
                placeholder={labels.firstName}
              />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <input
                id="nachname"
                type="text"
                className="form-control"
                placeholder={labels.lastName}
              />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <input
                id="email"
                type="email"
                className="form-control"
                aria-describedby="emailHelp"
                placeholder={labels.email}
              />
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-md-12">
            <div className="form-group">
              <textarea
                className="form-control"
                id="text"
                rows={15}
                placeholder={labels.message}
              ></textarea>
            </div>
          </div>
        </div>
        <div className="row" style={{ marginBottom: "50px" }}>
          <div className="col-lg-9"></div>
          <div className="col-lg-3">
            <a className="btn-democracy">
              <div id="send_contact" style={{ fontSize: "large" }} onClick={send}>
                <i className="fa fa-envelope"></i>
                {"  "}
                {labels.submit}
              </div>
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}
