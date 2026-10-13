import { getForms } from "@/lib/content";
import { BugReportFields, type BugReportTexts } from "./BugReportFields";
import { VolunteerFields, type VolunteerTexts } from "./VolunteerFields";

/**
 * Bug report form of default_engineering.tpl; texts from the MDX, alert
 * texts, recipient and subject from content/site/forms.yaml.
 */
export async function BugReportForm(texts: BugReportTexts) {
  const forms = await getForms();
  return <BugReportFields texts={texts} forms={forms} />;
}

/** Volunteer form ("Mithelfen") of default_engineering.tpl, like BugReportForm. */
export async function VolunteerForm(texts: VolunteerTexts) {
  const forms = await getForms();
  return <VolunteerFields texts={texts} forms={forms} />;
}
