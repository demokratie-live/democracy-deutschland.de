import { Children, Fragment, type ReactNode } from "react";
import { asset } from "@/lib/base-path";

/**
 * Row of the three symbol tiles (#si-panel). The tiles are inline-blocks, so
 * the whitespace between them matters like in the template.
 */
export function SymbolInfoPanel({ children }: { children: ReactNode }) {
  return (
    <div className="background-white" style={{ zIndex: 100, position: "relative" }}>
      <div id="si-panel" className="container page">
        {Children.toArray(children).map((child, index) => (
          <Fragment key={index}>
            {index > 0 && " "}
            {child}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Tile with icon (/files/images/<icon>.svg), heading and text. */
export function SymbolInfo({
  id,
  icon,
  heading,
  children,
}: {
  id: string;
  icon: string;
  heading: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="si-container" id={id}>
      <div className="symbolinfo">
        <div className="si-symbol">
          <img alt="" src={asset(`/files/images/${icon}.svg`)} />
        </div>
        <div className="si-symbol-bg"></div>
        <div className="si-subtitle">
          <p className="si-subtitle-heading">{heading}</p>
        </div>
      </div>
      <div className="si-content">{children}</div>
    </div>
  );
}
