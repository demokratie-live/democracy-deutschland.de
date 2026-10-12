import Link from "next/link";
import { Fragment } from "react";
import type { Footer as FooterData } from "@/lib/schemas";

/** Footer of default_page.tpl. */
export function Footer({ footer }: { footer: FooterData }) {
  const { logo, newsletter, columns, social, copyright } = footer;

  return (
    <div className="container-fluid">
      <div className="footer row">
        <div className="col-lg-4 footer-newsletter">
          <div className="logobox">
            <div className="edosz">{logo.name}</div>
            <div className="isabelle_layne">{logo.claim}</div>
          </div>
          <br />
          <div className="newsletterbox">
            <a
              href={newsletter.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-democracy"
              role="button"
              aria-label={newsletter.ariaLabel}
            >
              <div>{newsletter.label}</div>
            </a>
          </div>
        </div>
        {columns.map((column) => (
          <div key={column.title} className={column.className}>
            <h3>{column.title}</h3>
            <ul>
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} prefetch={false}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="col-lg-3 footer-sm">
          <h3>{social.title}</h3>
          <ul id="sm">
            {social.rows.map((row, rowIndex) => (
              <li key={rowIndex}>
                {row.map((icon, index) => (
                  <Fragment key={icon.href}>
                    {index > 0 && " \u00a0 "}
                    <a href={icon.href} target="_blank">
                      <i className={icon.icon}></i>
                    </a>
                  </Fragment>
                ))}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="copyright row">
        <div className="col-12">
          <i className="fab fa-creative-commons"></i> {copyright.text}{" "}
          <span className="edzofont">{copyright.brand}</span> {copyright.owner}
        </div>
      </div>
    </div>
  );
}
