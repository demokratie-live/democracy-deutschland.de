/**
 * Shared logic of the old website forms (contact, bug report, volunteer):
 * the checks of their click handlers and `sendMail()` of default_page.js.
 * Without a server the data goes to a configurable endpoint or into a
 * prefilled mailto (docs/server-funktionen.md). Texts: content/site/forms.yaml.
 */

/**
 * validateEmail() of default_invite.js, unchanged. default_contact.js and
 * default_engineering.js call it, but the main page never loads that file, so
 * live every form stopped here with a ReferenceError (docs/abweichungen.md).
 */
export function validateEmail(email: string): boolean {
  const re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/** One `if (…) { alert(message); $("#id").focus(); return null; }` of a click handler. */
export interface FormCheck {
  /** Element id of the field that gets the focus. */
  id: string;
  valid: boolean;
  message: string;
}

/**
 * Runs the checks in order like the old handlers: the first failing check
 * shows its alert, then focuses its field. Returns true when all pass.
 */
export function runChecks(checks: FormCheck[]): boolean {
  const failed = checks.find((check) => !check.valid);
  if (!failed) return true;
  window.alert(failed.message);
  document.getElementById(failed.id)?.focus();
  return false;
}

/** The `data` object of a form, e.g. `{ type: "contact", vorname, … }`. */
export type FormPayload = { type: string } & Record<string, string | boolean | null>;

/** Prefilled mail: one "Label: value" line per field, a blank line, then the message. */
export interface MailDraft {
  to: string;
  subject: string;
  fields: Array<[label: string, value: string]>;
  text: string;
}

/** mailto: URL of a draft (RFC 6068, line breaks as CRLF). */
export function mailtoUrl({ to, subject, fields, text }: MailDraft): string {
  const lines = [...fields.map(([label, value]) => `${label}: ${value}`), "", text];
  const body = lines.join("\r\n").replace(/\r?\n/g, "\r\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Subject of the old mail template ("DEMOCRACY Website: ${data_type} …"). */
export function mailSubject(template: string, type: string): string {
  return template.replace("{type}", type);
}

export type SendResult = "sent" | "failed" | "mailto";

export interface SendOptions {
  /** NEXT_PUBLIC_<FORM>_ENDPOINT; empty or undefined = no endpoint. */
  endpoint: string | undefined;
  data: FormPayload;
  mail: MailDraft;
  fetch?: typeof fetch;
  /** Opens the mailto URL (default: `window.location.href = url`). */
  openUrl?: (url: string) => void;
}

/**
 * Replacement of sendMail(): with an endpoint the data is POSTed as JSON
 * (success = HTTP 2xx, like `data.status` of api.php), otherwise the mail
 * program opens a prefilled mail to the recipient.
 */
export async function sendForm({
  endpoint,
  data,
  mail,
  fetch: fetchImpl = globalThis.fetch,
  openUrl = (url) => {
    window.location.href = url;
  },
}: SendOptions): Promise<SendResult> {
  if (!endpoint) {
    openUrl(mailtoUrl(mail));
    return "mailto";
  }
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
