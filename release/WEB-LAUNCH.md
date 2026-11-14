# Webversion — forberedt lokalt, ikke udgivet

Brugerens krav: webspillet må først komme online ved den endelige udgivelse. Denne ændring er ikke publiceret. Den nuværende hjemmeside og Android-downloads er uændrede online.

## Byg og verificér

- `npm run web:draft`: bygger et separat web-udkast i `web-draft/server.mjs` og `web-draft/game.html`.
- `npm run web:test`: bygger og tester browserlogin, samme gemte klub fra Android-origin, logout, CSRF-afvisning og adskillelse fra produktion.
- `npm test`: eksisterende 45 tests.
- `npm run release:check`: metadata og asset-kontrol.

Draft-worker viser spillet på `/play`, beholder præsentationssiden på `/`, og bruger samme D1-/auth-/spil-API. Browserlogin bruger HttpOnly/Secure/SameSite-cookie; Android fortsætter med Keystore-session. Ingen localStorage-tokens. Der er ingen ny Firebase-/Google-/Facebook-loginintegration.

Draft-udgaven viser privatliv, support og sletningsinformation fra appklienten, så tilbage-navigation går til `/play`. Webprivatliv omtaler login-cookien. Gendannelseskode kan kopieres eller gemmes som lokal tekstfil. Hjemmesidens præsentation ændres først, når webspillet frigives.

## Barriere mod tidlig publicering

Standardkommandoen `npm run build` skriver stadig kun den offentlige præsentationsside til `dist/server/index.js`. Webspillet indgår ikke i den worker. Draft-filer er ignoreret af Git og ligger uden for `dist/`; ingen hostingmanifest eller deploymentarchive peger på dem. Der er ingen serverindstilling, URL-parameter eller brugerhandling, der kan slå webspillet til i den nuværende produktionsworker. `/play` returnerer 404 i produktionsbuildet. Testen verificerer dette.

`web-draft/server.mjs` er et buildartefakt til lokal validering, ikke en online stagingadresse. En sikker lokal runtime skal have D1-kompatibel database, migrations og separat test-AUTH_PEPPER; brug aldrig produktionshemmeligheder eller persondata til lokale tests. Browserens Secure-cookie kræver en sikker origin. De automatiske integrationstests anvender reel SQLite og en isoleret testhemmelighed.

## Ved endelig udgivelse — kræver udtrykkelig frigivelse

1. Gennemfør browser-QA på mobil og desktop: signup/login/logout/recovery, kampe, genforbindelse, konto- og klubsletning, tastaturnavigation, downloads og responsivt layout. Interaktiv browser-QA er endnu ikke udført her.
2. Gennemgå login-cookie- og databehandling i den fælles privatlivspolitik.
3. Tilføj en eksplicit produktionsentry/route for `/play` og et tydeligt 'Spil i browseren'-link på præsentationssiden. Behold Android som særskilt download.
4. Byg et nyt produktionsartefakt fra den testede kildekode. Kopiér ikke blindt draft-workeren til produktion; den indeholder noindex og testmarkeringer.
5. Kontrollér Worker-størrelse og hostingkapacitet. De indlejrede downloadfiler fylder allerede tæt på Worker-grænsen; flyt eventuelt store binære downloads til egnet fillagring før yderligere vækst.
6. Publicér først efter brugerens udtrykkelige instruktion om endelig udgivelse. Kontrollér så HTTPS, /play, login og gemte klubber på det endelige domæne.

Ingen service worker/offline-play er implementeret; internet kræves ligesom i Android-appen. Dette er ikke en påstand om afsluttet browser-/enhedstest.
