import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mailSubject,
  mailtoUrl,
  runChecks,
  sendForm,
  validateEmail,
  type MailDraft,
} from "./forms";

const data = {
  type: "contact",
  vorname: "Max",
  nachname: "Mustermann",
  email: "max@example.org",
  text: "Hallo & tschüss\nZeile 2",
};
const mail: MailDraft = {
  to: "contact@democracy-deutschland.de",
  subject: "DEMOCRACY Website: contact",
  fields: [
    ["Vorname", "Max"],
    ["Nachname", "Mustermann"],
    ["Email", "max@example.org"],
  ],
  text: "Hallo & tschüss\nZeile 2",
};

test("validateEmail: the regex of default_invite.js", () => {
  for (const email of ["max@example.org", "Max.Muster@Sub.Example.DE", "a+b@x.io", '"a b"@x.de']) {
    assert.equal(validateEmail(email), true, email);
  }
  for (const email of ["", "kaputt", "a@b", "a@b.c", "a b@x.de", "a@@x.de", "a@x..de"]) {
    assert.equal(validateEmail(email), false, email);
  }
});

test("runChecks: alert of the first failing check, then focus on its field", () => {
  const calls: string[] = [];
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = { alert: (message: string) => calls.push(`alert ${message}`) };
  globals.document = {
    getElementById: (id: string) => ({ focus: () => calls.push(`focus ${id}`) }),
  };
  try {
    const checks = [
      { id: "a", valid: true, message: "A" },
      { id: "b", valid: false, message: "B" },
      { id: "c", valid: false, message: "C" },
    ];
    assert.equal(runChecks(checks), false);
    assert.deepEqual(calls, ["alert B", "focus b"]);
    assert.equal(runChecks(checks.slice(0, 1)), true);
    assert.equal(calls.length, 2);
  } finally {
    delete globals.window;
    delete globals.document;
  }
});

test("mailtoUrl: subject, one line per field, blank line, message (CRLF, encoded)", () => {
  const url = mailtoUrl(mail);
  assert.ok(url.startsWith("mailto:contact@democracy-deutschland.de?subject="));
  const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  assert.equal(params.get("subject"), "DEMOCRACY Website: contact");
  assert.equal(
    params.get("body"),
    "Vorname: Max\r\nNachname: Mustermann\r\nEmail: max@example.org\r\n\r\nHallo & tschüss\r\nZeile 2",
  );
  // encodeURIComponent, not "+" for spaces (mail programs take "+" literally)
  assert.ok(url.includes("subject=DEMOCRACY%20Website%3A%20contact&body=Vorname%3A%20Max%0D%0A"));
});

test("mailSubject fills the form type", () => {
  assert.equal(
    mailSubject("DEMOCRACY Website: {type}", "bugreport"),
    "DEMOCRACY Website: bugreport",
  );
});

test("sendForm without endpoint opens the prefilled mailto and sends nothing", async () => {
  for (const endpoint of [undefined, ""]) {
    const opened: string[] = [];
    const result = await sendForm({
      endpoint,
      data,
      mail,
      fetch: () => assert.fail("no request without endpoint"),
      openUrl: (url) => opened.push(url),
    });
    assert.equal(result, "mailto");
    assert.deepEqual(opened, [mailtoUrl(mail)]);
  }
});

test("sendForm with endpoint POSTs the data as JSON, 2xx = sent", async () => {
  const requests: Array<[string, RequestInit]> = [];
  const respond = (status: number) => async (url: string | URL | Request, init?: RequestInit) => {
    requests.push([String(url), init!]);
    return new Response(null, { status });
  };
  const openUrl = () => assert.fail("no mailto with endpoint");
  const endpoint = "https://forms.example.org/contact";

  assert.equal(await sendForm({ endpoint, data, mail, fetch: respond(200), openUrl }), "sent");
  const [url, init] = requests[0];
  assert.equal(url, endpoint);
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, { "Content-Type": "application/json" });
  assert.equal(init.body, JSON.stringify(data));

  assert.equal(await sendForm({ endpoint, data, mail, fetch: respond(500), openUrl }), "failed");
  const offline = async () => Promise.reject(new TypeError("Failed to fetch"));
  assert.equal(await sendForm({ endpoint, data, mail, fetch: offline, openUrl }), "failed");
});
