# Hosting auf Plesk

Die statische Seite läuft auf dem Plesk-Server, auf dem heute die PHP-Seite und WordPress liegen (Apache 2.4 ohne nginx davor). Erprobt wurde das am 2026-10-14 auf einer nicht öffentlichen Test-Subdomain mit dem Export ohne basePath. Der Build bleibt auf jedem statischen Host lauffähig, auch auf GitHub Pages mit und ohne basePath. Dort übernehmen die clientseitigen Weiterleitungen die Arbeit der `.htaccess`.

## `.htaccess`

`next build` schreibt `out/.htaccess` (Route-Handler `src/app/(site)/.htaccess/route.ts`, Inhalt aus `src/lib/htaccess.ts`). Die Datei wird aus `content/site/routes.yaml`, den Pfadregeln in `src/lib/legacy-paths.ts`, `content/site/app-links.yaml` und den Blog-Posts erzeugt. Bitte nicht von Hand ändern. Dieselben Daten nutzt die clientseitige Weiterleitung (`resolveLegacyUrl()`), die auf Hosts ohne `.htaccess` auf jeder Seite und auf der 404-Seite läuft.

| Regel                             | Alt                                                                                                                                     | Neu                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Seiten-Parameter, 301             | `/?page=<state>`, `/index.php?page=<state>`, `/?_escaped_fragment_=<state>`                                                             | Pfad aus `routes.yaml`, übrige Parameter bleiben (`?page=unsubscribe&token=X` → `/unsubscribe/?token=X`), unbekannte States → `/` |
| `index.php`, 301                  | `/index.php`                                                                                                                            | `/`                                                                                                                               |
| Aliase, 301                       | `/democracy/` (`aliases` in `routes.yaml`)                                                                                              | `/`                                                                                                                               |
| Kodierter Hash, 301               | `/%23!<state>` (democracy-client#1142, wie die alte `.htaccess`)                                                                        | `/#!<state>`, den Rest erledigt der Browser                                                                                       |
| Wahl-O-Meter-Schreibweisen, 301   | `/Wahlometer`, `/wahl-o-meter/`, …                                                                                                      | `/wahlometer/`                                                                                                                    |
| Invite, 301                       | `/invite`, `/invite/<code>`, `/invite.php?code=<code>`                                                                                  | `/` (das Tester-Onboarding gibt es nicht mehr, Code und Parameter entfallen)                                                      |
| App-Downloads, 302                | `/files/download/democracy-app.{apk,aab}`                                                                                               | GitHub-Release `latest` (302, weil „latest“ mit jedem Release wandert)                                                            |
| WordPress-Abfragen, 301           | `/blog/?p=<id>` (auch `?post_type=post&p=`), `?cat=<id>`, `?author=<id>`, `?tag=<slug>`, `?m=<jjjjmm>`, `?feed=rss2`, `/blog/index.php` | Permalink, Archiv bzw. `/blog/feed/`; unbekannte Post-IDs → 404 wie WordPress                                                     |
| Seite 1, 301                      | `/blog/page/1/`, `/blog/<archiv>/page/1/`                                                                                               | `/blog/`, `/blog/<archiv>/`                                                                                                       |
| Feeds                             | `…/feed/` (Datei `…/feed/index.html`), `…/feed/atom/`, `…/feed/rdf/`                                                                    | `application/rss+xml; charset=UTF-8`; Atom und RDF → 301 auf den RSS-Feed (statisch gibt es nur RSS 2.0)                          |
| Schrägstrich am Ende, 301         | `/ueber-uns`                                                                                                                            | `/ueber-uns/` (Apache `DirectorySlash`, keine eigene Regel)                                                                       |
| 404                               | jeder unbekannte Pfad                                                                                                                   | `/404.html` mit Status 404                                                                                                        |
| App-JSON                          | `/api.php`, `/api.php?call=donation_status`                                                                                             | intern `api/donation_status.json`, `application/json`, `Cache-Control: no-cache`                                                  |
| `X-Robots-Tag: noindex, nofollow` | jeder Host außer `democracy-deutschland.de` und `www.`                                                                                  | Test- und Vorschau-Hosts landen nicht in Suchmaschinen                                                                            |
| Zeichensatz                       | –                                                                                                                                       | `charset=utf-8` für HTML und Text, wie live                                                                                       |

Hash-Links (`#!<state>`) erreichen den Server nie und bleiben clientseitig (`LegacyRedirectScript`). `www.` → ohne `www.` und HTTP → HTTPS stellt Plesk ein (Hosting-Einstellungen), nicht die `.htaccess`.

**Prüfen:**

```bash
pnpm build
pnpm serve-apache                     # out/ mit dem Apache von macOS auf http://127.0.0.1:3098
pnpm check-htaccess                   # alle Regeln: Status, Location, Content-Type
pnpm check-htaccess https://<host>    # dieselben Prüfungen gegen Test oder Produktion
pnpm serve-apache stop
```

`pnpm check-htaccess` fragt jede alte Adresse aus `tests/legacy-urls.ts` ab (Status und `Location`), dieselbe Tabelle, mit der Playwright die clientseitige Weiterleitung mit und ohne basePath prüft, dazu Content-Types von Seiten, 404, App-JSON und Feeds. Neue alte Adressen kommen als State oder Alias in `routes.yaml` bzw. als Regel in `src/lib/legacy-paths.ts`, und mit einem Beispiel in `tests/legacy-urls.ts`.

## `api.php` und PHP

Gemessen auf Plesk mit derselben Datei `out/api.php` (reines JSON, kein `<?`), mit und ohne `?call=donation_status`:

| PHP der Domain | Umleitung auf die JSON-Datei | Antwort                                                                                              |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| an (7.4, FPM)  | nein                         | PHP führt die Datei aus (`X-Powered-By: PHP/7.4.33`), Inhalt unverändert, `text/html; charset=UTF-8` |
| aus            | nein                         | Apache liefert die Datei roh als `application/x-httpd-php` (wie GitHub Pages)                        |
| an oder aus    | ja (`.htaccess`)             | `application/json`, `Cache-Control: no-cache`, Inhalt unverändert, kein PHP                          |

Die App parst in allen Fällen (siehe `docs/server-funktionen.md`). **Für die Produktion: PHP-Unterstützung der Domain aus.** Die Umleitung liefert dann wie live `application/json`. Die statische Seite braucht kein PHP. Mit PHP an würde ein Text wie `<?php` oder `<?=` in `donation.yaml` (`json_encode` maskiert `<` nicht) als Code ausgeführt.

## Deploy: Plesk-Git mit Build-Zweig

Entscheidung 2026-10-14. Der Workflow `.github/workflows/deploy.yml` baut bei jedem Push auf `main` wie bisher und prüft lint, Inhalte, Unit- und E2E-Tests. Den Export ohne basePath (samt `.htaccess`) legt der Job `build-branch` mit `scripts/publish-build-branch.sh` als nächsten Commit auf den Zweig `deploy`. Der Zweig enthält nur den Export, ein Commit pro Build. Die Nachricht nennt den Quell-Commit. Dafür reicht das `GITHUB_TOKEN` des Workflows, ein Server-Zugang liegt nicht bei GitHub.

**Einrichtung in Plesk** (Websites & Domains → Domain → Git → Repository hinzufügen):

1. Remote-Repository `https://github.com/demokratie-live/democracy-deutschland.de.git` (öffentlich, ohne Schlüssel), Zweig `deploy`.
2. Serverpfad: ein eigener, leerer Ordner neben `httpdocs` (z.B. `/httpdocs-static`). Nicht `httpdocs`, dort liegen die alte PHP-Seite und WordPress.
3. Bereitstellungsmodus „Automatisch“ (jeder Build geht sofort live) oder „Manuell“ (Plesk holt den Zweig, bereitgestellt wird per Klick). Für „Automatisch“ die Webhook-URL, die Plesk anzeigt, in GitHub unter Settings → Webhooks eintragen (Push-Events). Die URL gehört nicht ins Repo.

**Rollback:** Den Zweig `deploy` auf einen älteren Build-Commit zurücksetzen (`git push --force origin <commit>:deploy`) und in Plesk abrufen und bereitstellen. Alternativ den Workflow für einen älteren `main`-Commit erneut laufen lassen.

**Noch zu prüfen beim Einrichten:** ob Plesk Dateien löscht, die aus dem Zweig verschwunden sind, und wo „Zusätzliche Bereitstellungsaktionen“ laufen (chroot, Arbeitsverzeichnis).

## Test- und Vorschau-Hosts

Ein Test-Host braucht vor den generierten Regeln einen Zugriffsschutz. Den fügt das Deployment für diesen Host hinzu, nicht das Repo:

```apache
<RequireAny>
  Require ip <erlaubte IP>
  Require expr %{REQUEST_URI} =~ m#^/\.well-known/acme-challenge/#
</RequireAny>
```

Die Ausnahme für `/.well-known/acme-challenge/` hält die Verlängerung des Let's-Encrypt-Zertifikats offen. `noindex` setzt die generierte `.htaccess` auf jedem Host außer der Produktion von selbst. Plesk bietet ohne nginx keine IP-Sperre als Einstellung, ein Passwortschutz („Passwortgeschützte Verzeichnisse“) ginge auch, sperrt aber automatische Prüfungen aus.

## Umstellung der Produktion

1. Plesk-Git für die Domain mit Serverpfad `/httpdocs-static` einrichten und einmal bereitstellen. Live ändert sich dadurch noch nichts.
2. Hosting-Einstellungen: Dokumentstamm `httpdocs` → `httpdocs-static`. PHP-Einstellungen: PHP-Unterstützung aus.
3. Prüfen: `pnpm check-htaccess https://democracy-deutschland.de` (ohne `X-Robots-Tag`), Spendenstand in der App, Stichproben mit `pnpm compare`.
4. Zurück: Dokumentstamm wieder `httpdocs`, PHP-Unterstützung an (7.4, FPM). Die PHP-Seite und WordPress laufen dann wie vorher, Dateien und Datenbank bleiben dafür unangetastet.
