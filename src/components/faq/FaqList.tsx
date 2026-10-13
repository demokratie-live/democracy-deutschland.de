"use client";

import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { asset } from "@/lib/base-path";
import {
  collapseClass,
  isExpanded,
  prepareHide,
  useCollapseTransition,
  type CollapsePhase,
} from "@/lib/bootstrap-collapse";

export interface FaqMenuItem {
  label: string;
  category?: string;
}

export interface FaqItem {
  question: string;
  categories: string[];
  /** Rendered answer (MDX of content/faq/faq.yaml). */
  answer: ReactNode;
}

/**
 * Question list of default_faq.tpl with init_faq(): the category menu filters
 * the questions (`.panel-faq` hide/show), every question opens and closes on
 * its own (Bootstrap collapse, `data-parent="#accordion"` points to nothing),
 * the arrow turns on show/hide. The first question is open on load, and after
 * a menu click the first visible question is open.
 */
export function FaqList({ menu, questions }: { menu: FaqMenuItem[]; questions: FaqItem[] }) {
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState<string | undefined>();
  // question.tpl: `${in}` = "show" for the first question only.
  const [phases, setPhases] = useState<CollapsePhase[]>(() =>
    questions.map((_, index) => (index === 0 ? "shown" : "hidden")),
  );
  // The arrow and the toggles change only after a show/hide event.
  const [touched, setTouched] = useState<boolean[]>(() => questions.map(() => false));
  const collapses = useRef<(HTMLDivElement | null)[]>([]);
  const register = useCallback((index: number, element: HTMLDivElement | null) => {
    collapses.current[index] = element;
  }, []);

  const update = (changes: Map<number, CollapsePhase>) => {
    for (const [index, phase] of changes) {
      if (phase === "hiding") prepareHide(collapses.current[index]);
    }
    setPhases((current) => current.map((phase, index) => changes.get(index) ?? phase));
    setTouched((current) => current.map((value, index) => value || changes.has(index)));
  };

  const toggle = (index: number) => (event: MouseEvent) => {
    event.preventDefault();
    const phase = phases[index];
    if (phase === "shown") update(new Map([[index, "hiding"]]));
    if (phase === "hidden") update(new Map([[index, "showing"]]));
  };

  // $('.faq-menu').click(…): filter, hide every open question, show the first
  // visible one. Live, show() runs while the first question may still be
  // hiding and is ignored; Bootstrap then opens the next one (docs/abweichungen.md).
  const select = (index: number) => (event: MouseEvent) => {
    event.preventDefault();
    const category = menu[index].category;
    const first = questions.findIndex(
      (question) => !category || question.categories.includes(category),
    );
    const changes = new Map<number, CollapsePhase>();
    phases.forEach((phase, i) => {
      if (i === first && phase === "hidden") changes.set(i, "showing");
      if (i !== first && phase === "shown") changes.set(i, "hiding");
    });
    setActive(index);
    setFilter(category);
    update(changes);
  };

  const done = (index: number) => () =>
    setPhases((current) =>
      current.map((phase, i) =>
        i !== index ? phase : phase === "showing" ? "shown" : phase === "hiding" ? "hidden" : phase,
      ),
    );

  return (
    <div className="row" style={{ textAlign: "left", paddingBottom: "100px" }}>
      <div className="col-lg-3">
        <ul className="faq-menu-container">
          {menu.map((item, index) => (
            <li key={index}>
              <a
                href={asset("/faq/")}
                className={index === active ? "faq-menu active" : "faq-menu"}
                {...{ category: item.category }}
                onClick={select(index)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="col-lg-9">
        {questions.map((question, index) => (
          <FaqPanel
            key={index}
            index={index}
            question={question}
            hidden={!!filter && !question.categories.includes(filter)}
            phase={phases[index]}
            touched={touched[index]}
            register={register}
            onToggle={toggle(index)}
            onComplete={done(index)}
          />
        ))}
      </div>
    </div>
  );
}

/** question.tpl */
function FaqPanel({
  index,
  question,
  hidden,
  phase,
  touched,
  register,
  onToggle,
  onComplete,
}: {
  index: number;
  question: FaqItem;
  hidden: boolean;
  phase: CollapsePhase;
  touched: boolean;
  register: (index: number, element: HTMLDivElement | null) => void;
  onToggle: (event: MouseEvent) => void;
  onComplete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useCollapseTransition(ref, phase, onComplete);

  const expanded = isExpanded(phase);
  // Bootstrap sets these on the toggles from the first show/hide on.
  const toggleProps = (className: string) => ({
    "data-toggle": "collapse",
    "data-parent": "#accordion",
    href: `#collapse${index}`,
    className: touched && !expanded ? `${className} collapsed` : className,
    "aria-expanded": touched ? expanded : undefined,
    onClick: onToggle,
  });
  // `${in_css}` for the first question, then rotate(180deg/0deg) from the
  // show.bs.collapse/hide.bs.collapse handlers of init_faq().
  const transform = expanded ? "rotate(180deg)" : touched ? "rotate(0deg)" : undefined;

  return (
    <div
      className={`panel-faq ${question.categories.join(" ")}`}
      style={hidden ? { display: "none" } : undefined}
    >
      <div className="panel-heading">
        <h5 className="panel-title">
          <a {...toggleProps("faq_header")}>{question.question}</a>{" "}
          <a {...toggleProps("faq_header2")}>
            <i
              className="openarrow fa fa-angle-down"
              aria-hidden="true"
              style={{
                transform,
                marginRight: "15px",
                float: "right",
                color: "rgb(199,199,204)",
                fontSize: "40px",
              }}
            ></i>
          </a>
        </h5>
      </div>
      <div
        id={`collapse${index}`}
        className={`panel-collapse ${collapseClass(phase)}`}
        ref={(element) => {
          ref.current = element;
          register(index, element);
        }}
      >
        <div className="panel-body" style={{ padding: "15px" }}>
          {question.answer}
        </div>
      </div>
    </div>
  );
}
