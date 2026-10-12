import Link from "next/link";

/**
 * Static 404 page. The live site answers unknown paths with the Apache error
 * page; here the frame stays (see docs/abweichungen.md).
 */
export default function NotFound() {
  return (
    <div className="container page">
      <div className="main-container">
        <h1>404</h1>
        <p>Diese Seite gibt es nicht.</p>
        <Link href="/" className="whitelink">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
