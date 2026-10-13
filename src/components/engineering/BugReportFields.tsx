"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { mailSubject, runChecks, sendForm, validateEmail } from "@/lib/forms";
import type { Forms } from "@/lib/schemas";

/** Inlined at build time; unset = prefilled mailto (docs/server-funktionen.md). */
const ENDPOINT = process.env.NEXT_PUBLIC_BUGREPORT_ENDPOINT;

/** <style> block of the file list in default_engineering.tpl. */
const FILE_LIST_CSS = `
#bug-file-list {
    display: none;
    border-radius: 0;
    border: rgb(151,151,151) 1px solid;
    border-top: 0;
}
#bug-file-list a {
    height: 15px;
    line-height: 2px;
    border-radius: 0;
}
#bug-file-list a span {
    margin-top: -9px;
}
#bug-file-list a span.hidden {
    display: none;
}
`;

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
  /** Drop zone: text before the link, link text, text after it. */
  dropText: string;
  dropLink: string;
  dropEnd: string;
  submit: string;
}

/** Placeholder without the "*" of required fields, used as mail label. */
export function label(placeholder: string): string {
  return placeholder.replace(/\*$/, "");
}

/**
 * `<form id="bug-form">` of default_engineering.tpl with the handlers of
 * init_engineering(): checks name, email, title and text (alert, then focus),
 * then sends like sendMail(). Files from the picker or drag & drop run the
 * synchronous part of upload(): progress bar at 0 %, a yellow entry in the
 * list. There is no upload server (docs/server-funktionen.md), so no request
 * follows and the entries stay in this state (decision Manuel 2026-10-13,
 * notice or upload service: TASK-88).
 */
export function BugReportFields({ texts, forms }: { texts: BugReportTexts; forms: Forms }) {
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  // $('#bug-progress').show() / $('#bug-file-list').show() and .hide()
  const [progressShown, setProgressShown] = useState(false);
  const [listDisplay, setListDisplay] = useState<"block" | "none">();

  const addFiles = (added: File[]) => {
    if (added.length === 0) return;
    setFiles((current) => [...current, ...added]);
    setProgressShown(true);
    setListDisplay("block");
  };

  const stop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const drop = (event: DragEvent) => {
    stop(event);
    const items = event.dataTransfer.items;
    if (!items) return;
    const dropped: File[] = [];
    for (const item of Array.from(items)) {
      // If dropped items aren't files, reject them
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) dropped.push(file);
    }
    addFiles(dropped);
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
      // upload_files of live before a server response: { <lastModified>: { file } },
      // a File serialises as {}.
      files: JSON.stringify(Object.fromEntries(files.map((file) => [file.lastModified, { file }]))),
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
      setFiles([]);
      setListDisplay("none");
      window.alert(messages.sent);
    } else if (result === "failed") {
      window.alert(messages.failed);
    }
  };

  return (
    <form id="bug-form" ref={form} onDragOver={stop} onDragLeave={stop} onDrop={drop}>
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
                  id="bug-file-drop-zone"
                  style={{
                    padding: "3px",
                    marginTop: "-7px",
                    textAlign: "left",
                    border: BORDER,
                    borderTop: 0,
                  }}
                >
                  {texts.dropText}
                  <a
                    id="bug-select-files"
                    href=""
                    onClick={(event) => {
                      event.preventDefault();
                      fileInput.current?.click();
                    }}
                  >
                    {texts.dropLink}
                  </a>
                  {texts.dropEnd}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  name="files[]"
                  id="bug-files"
                  multiple
                  style={{ display: "none" }}
                  onChange={(event) => addFiles(Array.from(event.currentTarget.files ?? []))}
                />
                <div className="js-upload-finished">
                  <div
                    id="bug-progress"
                    className="progress"
                    style={{
                      ...(progressShown ? {} : { display: "none" }),
                      borderRadius: 0,
                      borderLeft: BORDER,
                      borderRight: BORDER,
                    }}
                  >
                    <div
                      className="progress-bar"
                      role="progressbar"
                      aria-valuenow={progressShown ? 0 : 60}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ width: progressShown ? "0%" : "60%" }}
                    ></div>
                  </div>
                  <style>{FILE_LIST_CSS}</style>
                  <div
                    id="bug-file-list"
                    className="list-group"
                    style={listDisplay ? { display: listDisplay } : undefined}
                  >
                    {files.map((file, index) => (
                      <a
                        key={index}
                        target="_blank"
                        className={`${file.lastModified} list-group-item list-group-item-warning`}
                      >
                        <span className="badge alert-success pull-right hidden">Success</span>
                        {file.name}
                      </a>
                    ))}
                  </div>
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
