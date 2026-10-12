# Server-Funktionen der alten Seite

Die statische Seite läuft ohne Server (z.B. GitHub Pages). Diese Liste hält fest, was die PHP-Seite serverseitig erledigt hat, wie sich die statische Seite heute verhält und wie ein Ersatz aussehen könnte. Jedes portierte Modul ergänzt seine Einträge.

## Ersetzt

| Funktion                   | Alter Endpunkt                                                     | Statische Seite                                                                    | Ersatz      |
| -------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------- |
| Seiten laden (Hash-Router) | `api.php?call=pages&group=1&state=<state>`, danach HTML des Moduls | jede Seite ist eine statische HTML-Datei unter ihrem Pfad                          | nicht nötig |
| Server-HTML für Crawler    | `?_escaped_fragment_=<state>`                                      | statisches HTML; alte Crawler-URLs werden auf den neuen Pfad umgeleitet            | nicht nötig |
| Dateien                    | `/files/<kategorie>/<datei>` → `api.php?call=files&cat=…&id=…`     | statische Dateien unter `public/files/` mit denselben Pfaden                       | nicht nötig |
| CSS/JS-Cache               | `/cache/<id>/<ident>` → `api.php?call=cache`                       | Original-CSS unter `public/css/`, JavaScript als Next.js-Bundle                    | nicht nötig |
| Font-Awesome-Webfonts      | Rewrite `…/webfonts/fa-*` in `.htaccess`                           | statisch unter `public/css/font_awesome/webfonts/`                                 | nicht nötig |
| Newsletter-Anmeldung       | `api.php?call=send_subscribe`                                      | Link zu Listmonk (`https://listmonk.democracy-app.de/subscription/form`), wie live | erledigt    |

## Offen

| Funktion                      | Alter Endpunkt                                        | Statische Seite                                         | Möglicher Ersatz                                                                 |
| ----------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Besucherzähler und Aufruf-Log | `SYSTEM\LOG\COUNTER` bei jedem Aufruf von `index.php` | entfällt                                                | datensparsame Statistik (z.B. selbst gehostetes Plausible oder Umami)            |
| Kontakt, Bugreport, Mithelfen | `api.php?call=send_mail`                              | folgt mit den Formularen                                | Formular-Endpunkt per `NEXT_PUBLIC_<FORM>_ENDPOINT`, sonst vorbefüllte `mailto:` |
| Datei-Upload (Bugreport)      | `api.php?call=upload`                                 | folgt mit dem Bugreport-Formular                        | eigener Upload-Dienst                                                            |
| Beta-Codes (Invite)           | `api.php?call=beta`, `invite.php?code=…`              | folgt mit Invite                                        | Endpunkt der App-API                                                             |
| Newsletter abmelden           | `?page=unsubscribe&token=…`                           | Altlink leitet auf `/unsubscribe/?token=…`, Seite folgt | Listmonk-Abmeldelink                                                             |
| Blog-Suche                    | WordPress-Suche `/blog/?s=…`                          | folgt mit dem Blog                                      | clientseitige Suche über einen statischen Index                                  |
| Spendenstand für die App      | `api.php?call=donation_status`                        | folgt mit der Spenden-Seite                             | statische JSON-Datei aus YAML                                                    |
