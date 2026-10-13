import { MDXRemote } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";
import { Link } from "@/components/shared/Link";
import { getFaq } from "@/lib/content";
import { FaqList } from "./FaqList";

/** The answer is one paragraph inside .panel-body, without <p> (like the old HTML). */
function Inline({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

const answerComponents = { a: Link, p: Inline };

/** Menu and `${questions}` of default_faq.tpl from content/faq/faq.yaml. */
export async function Faq() {
  const { menu, questions } = await getFaq();
  return (
    <FaqList
      menu={menu}
      questions={questions.map(({ question, categories, answer }) => ({
        question,
        categories,
        answer: <MDXRemote source={answer.trim()} components={answerComponents} />,
      }))}
    />
  );
}
