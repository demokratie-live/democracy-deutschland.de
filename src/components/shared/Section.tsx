import type { CSSProperties, ReactNode } from "react";

/**
 * `<div class="background-white"><div id class="container page">` – the
 * wrapper of almost every block in the module templates.
 * `raised` adds the inline style `z-index: 100; position: relative;`,
 * `after` renders next to the container (e.g. spacer or corner image).
 */
export function Section({
  id,
  raised = false,
  style,
  after,
  children,
}: {
  id?: string;
  raised?: boolean;
  style?: CSSProperties;
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="background-white"
      style={raised ? { zIndex: 100, position: "relative" } : undefined}
    >
      <div id={id} className="container page" style={style}>
        {children}
      </div>
      {after}
    </div>
  );
}
