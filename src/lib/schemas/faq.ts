import { z } from "zod";

const category = z.string().regex(/^[a-z0-9-]+$/, "Kategorie in Kleinbuchstaben (a-z, 0-9, -)");

/**
 * content/faq/faq.yaml: category menu and questions of /faq/ (old table `faq`,
 * FAQS_SELECT, ordered by `order`).
 */
export const faqSchema = z
  .object({
    /** Items of the category menu (default_faq.tpl); without `category` = all. */
    menu: z.array(z.object({ label: z.string().min(1), category: category.optional() })).min(1),
    questions: z
      .array(
        z.object({
          question: z.string().min(1),
          /** Menu categories the question belongs to (CSS classes of .panel-faq). */
          categories: z.array(category).min(1),
          /**
           * MDX rendered as one paragraph without <p>, like the HTML of the old
           * table: line breaks as <br />, lists as <ul><li>…</li></ul>.
           * A blank line would start a new paragraph and is not allowed.
           */
          answer: z
            .string()
            .min(1)
            .refine((answer) => !/\n\s*\n/.test(answer.trim()), {
              message: "keine Leerzeilen, Zeilenumbrüche als <br />",
            }),
        }),
      )
      .min(1),
  })
  .superRefine((faq, ctx) => {
    const known = new Set(faq.menu.flatMap((item) => (item.category ? [item.category] : [])));
    faq.questions.forEach((question, index) => {
      for (const name of question.categories) {
        if (!known.has(name)) {
          ctx.addIssue({
            code: "custom",
            path: ["questions", index, "categories"],
            message: `Kategorie "${name}" fehlt im Menü`,
          });
        }
      }
    });
  });
export type Faq = z.infer<typeof faqSchema>;
export type FaqQuestion = Faq["questions"][number];
