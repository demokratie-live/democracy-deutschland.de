"use client";

import { Children, isValidElement, useState, type ReactElement, type ReactNode } from "react";

interface ComparisonRowProps {
  left: string;
  right: string;
  leftText: ReactNode;
  rightText: ReactNode;
}

/** Declarative child of <ComparisonAccordion>; rendered by the accordion. */
export function ComparisonRow(props: ComparisonRowProps) {
  void props;
  return null;
}

/**
 * "Was ist der Unterschied zum Wahl-O-Mat?" (inline script of
 * default_wahlometer.tpl): one row is open; clicking a grey box opens its row
 * and moves the two coloured titles there.
 */
export function ComparisonAccordion({
  leftTitle,
  rightTitle,
  leftColor,
  rightColor,
  children,
}: {
  leftTitle: string;
  rightTitle: string;
  leftColor: string;
  rightColor: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children)
    .filter((child): child is ReactElement<ComparisonRowProps> => isValidElement(child))
    .map((child) => child.props);
  const [open, setOpen] = useState(0);
  // After the first click every .haken carries an inline display style.
  const [clicked, setClicked] = useState(false);

  const select = (index: number) => {
    setOpen(index);
    setClicked(true);
  };

  return rows.map((row, index) => {
    const isOpen = index === open;
    const hakenStyle = isOpen
      ? { display: "none" }
      : clicked
        ? { display: "inline-table" }
        : undefined;
    return (
      <div key={index} className={`containerrow-acc container-${index + 1} px-lg-5`}>
        <div className={isOpen ? "rectanglebox-acc content-open" : "rectanglebox-acc"}>
          {isOpen && (
            <div id="rectanglebox-acc-boundary" className="row pt-5">
              <div className="col-6 ">
                <div className="pl-0 pl-sm-0 pl-md-0 pl-lg-0">
                  <h3 className="ri-title-heading-acc" style={{ backgroundColor: leftColor }}>
                    {leftTitle}
                  </h3>
                </div>
              </div>
              <div className="col-6">
                <div className="pl-0 pl-sm-0 pl-md-0 pl-lg-0">
                  <h3 className="ri-title-heading-acc" style={{ backgroundColor: rightColor }}>
                    {rightTitle}
                  </h3>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="row">
          <div className="col-6">
            <div
              className="mr-0 bg-light ri-subtitle-heading-acc"
              style={index === 0 ? { width: "95%" } : undefined}
              onClick={() => select(index)}
            >
              <p className="ri-subtitle-left">{row.left}</p>
              <div className="haken" style={hakenStyle}>
                {"\u2304"}
              </div>
            </div>
          </div>
          <div className="col-6">
            <div
              className="ml-0 pl-sm-2 pl-md-2 pl-lg-2 bg-light ri-subtitle-heading-acc"
              onClick={() => select(index)}
            >
              <p className="ri-subtitle-right">{row.right}</p>
              <div className="haken" style={hakenStyle}>
                {"\u2304"}
              </div>
            </div>
          </div>
        </div>
        <div
          className="row container-text-acc"
          style={{ display: isOpen ? "inline-flex" : "none" }}
        >
          <div className="col-6">
            <div className="acc-content-left">{row.leftText}</div>
          </div>
          <div className="col-6">
            <div className="acc-content-right">{row.rightText}</div>
          </div>
        </div>
      </div>
    );
  });
}
