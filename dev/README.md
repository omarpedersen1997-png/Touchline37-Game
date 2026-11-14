# Touchline 37 – lokalt testmiljø

Testmiljøet kører spillet lokalt med fiktive testkonti. Det har ingen forbindelse til produktionsserveren, produktionsdatabasen, R2 eller hjemmesiden.

## Kom i gang

Kør fra repositoryets rod. Det kræver Node 22.13 eller nyere, fordi testmiljøet bruger `node:sqlite`.

```sh
npm ci
npm run dev:server
```

`dev:server` gør tre ting:
1. Bygger den lokale webudgave af spillet (`web-draft/`, som Git ignorerer).
2. Opretter testkonti, hvis de mangler. Det gør `dev/seed.mjs`.
3. Starter serveren på `http://127.0.0.1:8787`. Spillet ligger på `/play`.

Brug `DEV_PORT=9000 npm run dev:server` for at vælge en anden port.

## Testkonti

Alle konti er fiktive. Domænet `.invalid` kan aldrig modtage mail.

| E-mail | Adgangskode | Klub |
|---|---|---|
| test1@touchline.invalid | Touchline-test-1 | Ny klub (startniveau) |
| test2@touchline.invalid | Touchline-test-2 | Testby FC (etableret) |
| test3@touchline.invalid | Touchline-test-3 | Prøvelund BK (mange penge, høje niveauer) |

Du kan også oprette nye konti direkte i spillet. De gemmes kun lokalt.

## Kommandoer

| Kommando | Funktion |
|---|---|
| `npm run dev:server` | Bygger, opretter testkonti og starter testserveren |
| `npm run dev:seed` | Opretter kun testkonti |
| `npm run dev:reset` | Sletter alle lokale testdata i `.dev-data/` |
| `npm run test:isolation` | Kører spærre- og størrelsestestene alene |

## Hvor ligger data

Alt ligger i `.dev-data/`, som Git ignorerer:
- `touchline-dev.sqlite` er den lokale database, oprettet med migreringerne i `drizzle/`.
- `test-pepper.txt` er en tilfældig testhemmelighed, der laves lokalt. Den er ikke produktionens `AUTH_PEPPER`.

R2-lageret erstattes af et lager i hukommelsen, som tømmes ved genstart.

## Sådan er produktionen spærret

- **Ingen produktionsvariabler:** Serveren og seed-scriptet nægter at starte, hvis en af produktionens variabler er sat, f.eks. `AUTH_PEPPER`, mailnøgler, Cloudflare-tokens eller signeringsvariabler. Listen står i `dev/isolation.mjs`.
- **Ingen udgående trafik:** Al udgående `fetch` og `WebSocket` fra Worker-koden blokeres og registreres.
- **Kun lokal lytning:** Serveren lytter kun på `127.0.0.1` eller `localhost`.
- **`tests/production-isolation.test.mjs` fejler, hvis:**
  - testmiljøets kode nævner produktionsværter eller Sites-projektet,
  - produktionens API-adresse dukker op andre steder end i den eksisterende `TouchlineApiPlugin.java`,
  - `.openai/hosting.json` bruges af andet end `build.mjs`,
  - et fuldt forløb (oprettelse, login, gemning og kontaktformular) forsøger at lave en udgående forbindelse.
- **`tests/bundle-budget.test.mjs`** kontrollerer serverpakkens komprimerede størrelse. Hostinggrænsen er ikke bekræftet, så testen fejler allerede ved 9,4 MB og advarer over 9,0 MB. Den dokumenterede grænse er 10 MiB.

Begge tests indgår i `npm test`.

## Begrænsninger

- **Kun webudgaven:** Testmiljøet kører webudgaven af spillet (`/play`), ikke Android-appen. En test-APK med eget app-id er en senere opgave (M4).
- **Ingen mails:** Mailafsendelse er ikke slået til, og nulstilling af adgangskode via mail virker derfor ikke lokalt.
- **Lanceringslåsen gælder stadig for APK-download.** Den lokale webudgave viser `/play` uanset lanceringstidspunktet, ligesom den eksisterende `web:draft`.
