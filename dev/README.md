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

## Fastfrysning af baseline (M2)

### Kampmotor 1–10

`tests/engine-freeze.test.mjs` indgår i `npm test` og fejler, hvis:
- en af motorfilerne 1–10 ændres med blot én byte. SHA256-værdierne er de samme som i baseline `c71fbb7` og `BACKUP-MANIFEST.json`,
- dispatcheren i `shared/arcade.js` ikke længere sender version 1–10 til deres oprindelige motor,
- en fast, deterministisk genafspilning pr. motor giver en anden sluttilstand eller slutstilling,
- serverens dekodning af en gemt optagelse giver et andet resultat end klientens.

Nye kampregler skal ligge i en ny motorfil (motor 11+). De frosne filer må aldrig ændres.

### Design (referencebilleder)

`tests/visual/baseline/` indeholder 20 referencebilleder af appen i bredformat (915 × 412, skalering 2):
- **Login:** e-mail, adgangskode og opret konto.
- **Klub og hold:** Klub, Hold (Opstilling og Taktik & trup).
- **Kampe:** Liga, Pokal og Europa.
- **Center:** Strategi & udvikling og Klubdesign.
- **Mere-menuen og dens skærme:** Transfermarked, Klubudvikling, Spillerkarriere, Mål & karriere, Klub & konto og Hjælp & spilleregler.
- **En helt ny klub:** Klub og Hold.

Billederne tages i testmiljøet med en frisk, midlertidig database. Der logges ind én gang pr. konto, så spillets loginbegrænsning ikke rammes.

| Kommando | Funktion |
|---|---|
| `npm run visual:check` | Tager nye billeder og sammenligner dem med referencen. Afvigende pixels markeres i `.dev-data/visual/diff/`. |
| `npm run visual:baseline` | Erstatter referencen. Må kun køres efter en godkendt designændring. |

Sådan virker sammenligningen:
- **Kun i testbrowseren:** Animationer slås fra under optagelsen. Klubsaldoen, transferbudgettet og gemmestatus skjules med fast bredde, fordi de ændrer sig med serverens ur. Selve appen ændres ikke.
- **Grænse:** Højst 0,02 % af pixels må afvige, med en tolerance på 24 pr. farvekanal.
- **Afprøvet:** En ny reference gav 0 afvigelser i tre rene kørsler i træk. Simulerede designændringer blev opdaget: ændrede hjørner på 19 af 20 skærme og ændrede farver på 20 af 20.
- **Beskyttet mod sletning:** `tests/visual-baseline.test.mjs` indgår i `npm test` og kontrollerer, at referencebillederne findes og matcher `manifest.json`.

Referencen er taget med Chromium via Playwright 1.63. En anden browserversion kan tegne skrift en smule anderledes. I så fald tages en ny reference med `visual:baseline` på den uændrede `main`.

### Bevaringstag

`npm run tag:prepare` kontrollerer, at `main` stadig peger på baseline (`e9b04e6`), og at motorfilerne dér er de frosne. Derefter udskriver scriptet kommandoerne til tagget `bevaring/apk37`. Scriptet **opretter og pusher intet**. Tagget må først oprettes efter ejerens særskilte godkendelse.

## Forhåndsvisning i Claude-appen

Claude-appens forhåndsvisning går gennem en https-proxy. Testserveren bestemmer browserens adresse ud fra `X-Forwarded-Host`/`X-Forwarded-Proto`, `Forwarded` eller `Origin` på samme vært. Derfor virker spillets egen beskyttelse mod forespørgsler fra fremmede adresser uændret, og login lykkes gennem proxyen. `tests/dev-preview.test.mjs` afprøver login, indlæsning og gemning gennem en simuleret https-proxy og kontrollerer, at fremmede adresser stadig afvises.

Alle forespørgsler logges i `.dev-data/requests.log` med metode, sti, status og de adresse-headere, proxyen sendte. Loggen indeholder aldrig cookies, adgangskoder eller forespørgselsindhold. Hvis login fejler i forhåndsvisningen, viser loggen hvorfor.

## Begrænsninger

- **Kun webudgaven:** Testmiljøet kører webudgaven af spillet (`/play`), ikke Android-appen. En test-APK med eget app-id er en senere opgave (M4).
- **Ingen mails:** Mailafsendelse er ikke slået til, og nulstilling af adgangskode via mail virker derfor ikke lokalt.
- **Lanceringslåsen gælder stadig for APK-download.** Den lokale webudgave viser `/play` uanset lanceringstidspunktet, ligesom den eksisterende `web:draft`.
