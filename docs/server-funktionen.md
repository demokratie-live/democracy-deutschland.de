# Server-Funktionen der alten Seite

Die statische Seite läuft ohne Server (z.B. GitHub Pages). Diese Liste hält fest, was die PHP-Seite serverseitig erledigt hat, wie sich die statische Seite heute verhält und wie ein Ersatz aussehen könnte. Jedes portierte Modul ergänzt seine Einträge.

## Ersetzt

| Funktion                   | Alter Endpunkt                                                     | Statische Seite                                                                                         | Ersatz                              |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Seiten laden (Hash-Router) | `api.php?call=pages&group=1&state=<state>`, danach HTML des Moduls | jede Seite ist eine statische HTML-Datei unter ihrem Pfad                                               | nicht nötig                         |
| Server-HTML für Crawler    | `?_escaped_fragment_=<state>`                                      | statisches HTML; alte Crawler-URLs werden auf den neuen Pfad umgeleitet                                 | nicht nötig                         |
| Dateien                    | `/files/<kategorie>/<datei>` → `api.php?call=files&cat=…&id=…`     | statische Dateien unter `public/files/` mit denselben Pfaden                                            | nicht nötig                         |
| CSS/JS-Cache               | `/cache/<id>/<ident>` → `api.php?call=cache`                       | Original-CSS unter `public/css/`, JavaScript als Next.js-Bundle                                         | nicht nötig                         |
| Font-Awesome-Webfonts      | Rewrite `…/webfonts/fa-*` in `.htaccess`                           | statisch unter `public/css/font_awesome/webfonts/`                                                      | nicht nötig                         |
| Newsletter-Anmeldung       | `api.php?call=send_subscribe`                                      | Link zu Listmonk (`https://listmonk.democracy-app.de/subscription/form`), wie live                      | erledigt                            |
| Spendenstand für die App   | `api.php?call=donation_status`                                     | statische Dateien `/api.php` und `/api/donation_status.json`, beim Build aus YAML erzeugt (siehe unten) | erledigt, braucht die Domain-Wurzel |
| Spendenstand pflegen       | SAI: Text „donation“ und Tabelle `donate`                          | `content/donate/donation.yaml`, Ablauf in der README                                                    | erledigt                            |
| Team auf „Über uns“        | fest im PHP-Code `default_about::html()`                           | `content/team/team.yaml`, Ablauf in der README                                                          | erledigt                            |

## Offen

| Funktion                      | Alter Endpunkt                                        | Statische Seite                                         | Möglicher Ersatz                                                                 |
| ----------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Besucherzähler und Aufruf-Log | `SYSTEM\LOG\COUNTER` bei jedem Aufruf von `index.php` | entfällt                                                | datensparsame Statistik (z.B. selbst gehostetes Plausible oder Umami)            |
| Kontakt, Bugreport, Mithelfen | `api.php?call=send_mail`                              | folgt mit den Formularen                                | Formular-Endpunkt per `NEXT_PUBLIC_<FORM>_ENDPOINT`, sonst vorbefüllte `mailto:` |
| Datei-Upload (Bugreport)      | `api.php?call=upload`                                 | folgt mit dem Bugreport-Formular                        | eigener Upload-Dienst                                                            |
| Beta-Codes (Invite)           | `api.php?call=beta`, `invite.php?code=…`              | folgt mit Invite                                        | Endpunkt der App-API                                                             |
| Newsletter abmelden           | `?page=unsubscribe&token=…`                           | Altlink leitet auf `/unsubscribe/?token=…`, Seite folgt | Listmonk-Abmeldelink                                                             |
| Blog-Suche                    | WordPress-Suche `/blog/?s=…`                          | folgt mit dem Blog                                      | clientseitige Suche über einen statischen Index                                  |

## Spenden-JSON für die App

Die App (democracy-client, `src/api/apollo/index.tsx`) fragt den Spendenstand fest unter `https://democracy-deutschland.de/api.php` mit `?call=donation_status` ab (apollo-link-rest 0.9.0, Query `DonationStatus` in `src/screens/Donate/graphql/query/donationStatus.ts`). Ausgelieferte App-Versionen behalten diese URL.

**Statische Seite:** Der Build erzeugt `/api.php` und `/api/donation_status.json` aus `content/donate/donation.yaml` (Route-Handler mit `force-static`, `src/lib/donation-route.ts`). Der Inhalt entspricht Byte für Byte der PHP-Ausgabe von `call_donation_status()`: gleiche Schlüssel und Reihenfolge, Zahlen als JSON-Zahlen, Prozentwerte wie PHP 7.4 `round()`, Escaping wie `json_encode()` (`\/`, `\uXXXX`). Nur `querytime` ist 0 (siehe `docs/abweichungen.md`). Ein statischer Host ignoriert den Query-String; jede Anfrage an `/api.php` liefert deshalb den Spendenstand.

**Content-Type, geprüft am 2026-10-13:**

- Laut GitHub-Doku stammen die MIME-Typen von GitHub Pages aus mime-db. Für `.php` ist das `application/x-httpd-php`, nicht `application/json`. `serve` (lokal, Playwright) nutzt dieselbe Tabelle; ein E2E-Test prüft Header und Inhalt.
- apollo-link-rest 0.9.0 prüft den Content-Type nicht: Bei Status 2xx ruft es `response.json()` auf (`restLink.js`), 404 wird zu `null`, andere Fehler werfen.
- Die Datei enthält nur ASCII (Umlaute als `\uXXXX` wie bei PHP), der Zeichensatz im Header spielt also keine Rolle.
- Praxistest: Die Query der App mit `RestLink` aus apollo-link-rest 0.9.0 und `@apollo/client` 3.13.5 (Versionen aus dem Lockfile der App) gegen den Export geprüft. Getestet wurden die Content-Types `application/x-httpd-php`, `application/octet-stream`, `text/html`, `text/plain; charset=iso-8859-1`, kein Header sowie `serve out`. In allen Fällen kam das vollständige `result` an, identisch mit live.

Kein Server-Ersatz nötig. **Voraussetzungen beim Umzug (m-7):**

- Die Seite muss unter der Domain-Wurzel laufen (eigene Domain ohne basePath). Unter der Projekt-URL `…github.io/democracy-deutschland.de/api.php` findet die App die Datei nicht.
- Die App ruft `api.php` ohne `www.` auf, die Downloads (`Gemeinnutzigkeit_DEMOCRACY.pdf`, `Satzung_DEMOCRACY.pdf`, `Vereinfachter_Zuwendungsnachweis.pdf` unter `/files/download/`) dagegen mit `www.`. Beide Hostnamen müssen die Seite ausliefern oder umleiten. Die drei PDFs liegen unter den alten Pfaden.
- GitHub Pages cacht mit `Cache-Control: max-age=600`; ein neuer Spendenstand erreicht die App also bis zu 10 Minuten nach dem Deploy.
- Andere Aufrufe der alten API (`api.php?call=pages`, `send_mail` …) liefern statt einer Fehlermeldung ebenfalls den Spendenstand. Die App nutzt nur `donation_status`.
