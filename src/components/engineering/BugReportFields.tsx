"use client";

import { useRef, type DragEvent, type ReactNode } from "react";
import { mailSubject, runChecks, sendForm, validateEmail } from "@/lib/forms";
import type { Forms } from "@/lib/schemas";

/** Inlined at build time; unset = prefilled mailto (docs/server-funktionen.md). */
const ENDPOINT = process.env.NEXT_PUBLIC_BUGREPORT_ENDPOINT;

const BORDER = "rgb(151,151,151) 1px solid";

export interface BugReportTexts {
  heading: string;
  intro: ReactNode;
  /** Placeholders; without the trailing "*" also the labels in the prefilled mail. */
  name: string;
  email: string;
  title: string;
  platform: string;
  version: string;
  text: string;
  /**
   * Notice in place of the file picker, how screenshots arrive: without an
   * endpoint in the mail that opens, with one by mail to `{recipient}`
   * (rendered as a mailto link to `recipient` of forms.yaml).
   */
  attachMailto: string;
  attachEndpoint: string;
  submit: string;
}

/** Placeholder without the "*" of required fields, used as mail label. */
export function label(placeholder: string): string {
  return placeholder.replace(/\*$/, "");
}

/** Notice text with `{recipient}` as a mailto link; other placeholders fail the build. */
function attachNotice(template: string, recipient: string): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, index) => {
    if (!/^\{\w+\}$/.test(part)) return part;
    if (part !== "{recipient}") {
      throw new Error(`Unbekannter Platzhalter ${part} in „${template}“`);
    }
    return (
      <a key={index} href={`mailto:${recipient}`}>
        {recipient}
      </a>
    );
  });
}

/**
 * `<form id="bug-form">` of default_engineering.tpl with the handlers of
 * init_engineering(): checks name, email, title and text (alert, then focus),
 * then sends like sendMail(). There is no upload server
 * (docs/server-funktionen.md): instead of the file picker, drop zone, progress
 * bar and file list a notice in the drop zone's box says how screenshots
 * arrive (decision Manuel 2026-10-13). The drag handlers stay without
 * upload(), so a file dropped on the form does nothing instead of replacing
 * the page.
 */
export function BugReportFields({ texts, forms }: { texts: BugReportTexts; forms: Forms }) {
  const form = useRef<HTMLFormElement>(null);
  // Both texts are parsed, so a wrong placeholder fails every build.
  const mailtoNotice = attachNotice(texts.attachMailto, forms.recipient);
  const endpointNotice = attachNotice(texts.attachEndpoint, forms.recipient);

  const stop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const send = async () => {
    const value = (id: string) => (form.current?.querySelector(`#${id}`) as HTMLInputElement).value;
    const data = {
      type: "bugreport",
      name: value("bug-name"),
      email: value("bug-email"),
      title: value("bug-title"),
      platform: value("bug-platform"),
      version: value("bug-version"),
      text: value("bug-text"),
    };
    const { messages } = forms;
    const valid = runChecks([
      { id: "bug-name", valid: data.name.length >= 3, message: messages.firstName },
      { id: "bug-email", valid: validateEmail(data.email), message: messages.email },
      { id: "bug-title", valid: data.title.length >= 3, message: messages.text },
      { id: "bug-text", valid: data.text.length >= 3, message: messages.text },
    ]);
    if (!valid) return;

    const result = await sendForm({
      endpoint: ENDPOINT,
      data,
      mail: {
        to: forms.recipient,
        subject: mailSubject(forms.subject, data.type),
        fields: [
          [label(texts.name), data.name],
          [label(texts.email), data.email],
          [label(texts.title), data.title],
          [label(texts.platform), data.platform],
          [label(texts.version), data.version],
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
    <form id="bug-form" ref={form} onDragOver={stop} onDragLeave={stop} onDrop={stop}>
      <div className="col-12" style={{ paddingTop: "50px" }}>
        <h1>{texts.heading}</h1>
        <h5 style={{ paddingTop: "30px" }}>{texts.intro}</h5>
        <div className="row" style={{ paddingTop: "50px" }}>
          <div className="col-lg-12">
            <div className="row" style={{ paddingTop: "5px", paddingBottom: "5px" }}>
              <div className="col-lg-6">
                <input
                  id="bug-name"
                  type="text"
                  placeholder={texts.name}
                  style={{ width: "100%" }}
                />
              </div>
              <div className="col-lg-6">
                <input
                  id="bug-email"
                  type="email"
                  placeholder={texts.email}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div className="row" style={{ paddingTop: "5px", paddingBottom: "5px" }}>
              <div className="col-lg-6">
                <input
                  id="bug-title"
                  type="text"
                  placeholder={texts.title}
                  style={{ width: "100%" }}
                />
              </div>
              <div className="col-lg-3">
                <input
                  id="bug-platform"
                  type="text"
                  placeholder={texts.platform}
                  style={{ width: "100%" }}
                />
              </div>
              <div className="col-lg-3">
                <input
                  id="bug-version"
                  type="text"
                  placeholder={texts.version}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div className="row" style={{ paddingTop: "5px", paddingBottom: "5px" }}>
              <div className="col-lg-12">
                <textarea
                  id="bug-text"
                  placeholder={texts.text}
                  style={{
                    width: "100%",
                    minHeight: "300px",
                    border: BORDER,
                    borderBottom: "rgb(151,151,151) 1px dashed",
                  }}
                ></textarea>
                <div
                  id="bug-attachments"
                  style={{
                    padding: "3px",
                    marginTop: "-7px",
                    textAlign: "left",
                    border: BORDER,
                    borderTop: 0,
                  }}
                >
                  {ENDPOINT ? endpointNotice : mailtoNotice}
                </div>
              </div>
            </div>
            <div className="row" style={{ paddingTop: "5px", paddingBottom: "5px" }}>
              <div className="col-lg-9"></div>
              <div className="col-lg-3">
                <a id="bug-send" className="btn-democracy" onClick={send}>
                  <div style={{ border: 0 }}>{texts.submit}</div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
