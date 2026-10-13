import { getForms } from "@/lib/content";
import { ContactFormFields, type ContactFormLabels } from "./ContactFormFields";

/**
 * Form column of default_contact.tpl; placeholders and button label come from
 * the MDX, alert texts, recipient and subject from content/site/forms.yaml.
 */
export async function ContactForm(labels: ContactFormLabels) {
  const forms = await getForms();
  return <ContactFormFields labels={labels} forms={forms} />;
}
