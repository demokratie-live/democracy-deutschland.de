import Link from "next/link";

/**
 * Content of the static 404 page (src/app/global-not-found.tsx). The live site
 * answers unknown paths with the Apache error page; here the website frame
 * stays, also for unknown paths under /blog/ (see docs/abweichungen.md).
 */
export function NotFound() {
  return (
    <div className="container page">
      <div className="main-container">
        <h1>404</h1>
        <p>Diese Seite gibt es nicht.</p>
        <Link href="/" className="whitelink" prefetch={false}>
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
