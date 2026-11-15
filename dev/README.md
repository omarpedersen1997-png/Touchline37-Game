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

## Stabilitet og teknisk kvalitet (M3)

### Kampmotorernes versioner (`shared/engine-versions.js`)

Alle versionsregler står ét sted og bruges af `worker/game.js`, `worker/player-career.js`, `worker/manual.js`, `worker/index.js` og appen (`src/match-versions.js`).

| Anmodning fra appen | Ny kamp får |
|---|---|
| Ingen version (meget gamle apps) | Motor 1, uændret fra baseline |
| Version 2–10 (fx APK 37 = 10) | Den version |
| Nyere version, som serveren ikke kender (fx 11) | Motor 10 (før M3: motor 1) |
| Ugyldig værdi (tekst, decimaltal, 0) | Motor 1, uændret fra baseline |

En gemt eller igangværende kamp genafspilles altid med sin oprindelige motor. Har en gemt kamp en ukendt version, afvises den med "Kampversionen understøttes ikke". Den omskrives aldrig til motor 10.

`/api/game` sender nu `matchVersions: {supported:[1…10], latest:10}`. Feltet er en ren tilføjelse, og databasen er uændret. Appen beder om den nyeste version, som både den og serveren kender. Hvis serveren ikke sender feltet (en ældre server), antager appen motor 10.

### Netværk (`src/network.js`)

- **Tidsgrænser:** I webudgaven er der 15 s for hentning og 20 s for handlinger. Android-broen beholder sine egne 15 s + 20 s.
- **Fejlsider:** Et svar, der ikke er JSON (fx en fejlside eller wifi-login), bliver til den eksisterende danske fejltekst i stedet for et nedbrud.
- **Automatiske genforsøg:** Kun for `/api/game`, højst to ekstra forsøg med 0,4 s og 1,2 s pause, ved afbrudt forbindelse, tidsudløb eller 502/503/504.
  - Handlinger sendes igen med **præcis samme indhold og handlings-id**. Serveren udfører et kendt id højst én gang, så der kommer aldrig dobbelte belønninger eller køb.
  - Login, konto, adgangskode, sletning og kontakt gentages aldrig.
- **Afbrydelser:** Kalderens egen afbrydelse (AbortError) og fejl som "for stor optagelse" sendes uændret videre.

### Ydeevne (`npm run perf`)

`dev/perf.mjs` måler i testmiljøet med en telefon-viewport i bredformat. Resultatet er medianen af 3 kørsler, og hver kørsel bruger en frisk database. Resultatet gemmes i `.dev-data/perf/latest.json`. Brug `--cpu 1` uden CPU-nedsættelse og `--runs 5` for flere kørsler.

Målinger fra 15. november 2026:

| Måling | Baseline (M2), CPU 4× | M3, CPU 4× | M3, CPU 1× |
|---|---|---|---|
| App-HTML | 5,49 MB | 5,49 MB | 5,49 MB |
| DOMContentLoaded | 1.698 ms | 1.560 ms | 356 ms |
| Loginformular synlig | 3.047 ms | 2.893 ms | 725 ms |
| Login → klubskærm | 366 ms | 397 ms | 133 ms |
| "Spil selv i 3D" → kamp tegnet | 6.624 ms | 7.077 ms | 3.961 ms |
| Billedrate i 3D-kamp | 1,6 fps | 1,7 fps | 2 fps |
| JS-heap efter opstart / login / 3D | 3,2 / 5,4 / 15,3 MB | 3,3 / 5,4 / 15,2 MB | 3,3 / 5,4 / 15,5 MB |
| Eksterne forespørgsler | 0 | 0 | 0 |

M3 ændrer ikke ydeevnen målbart. Forskellene ligger inden for måleusikkerheden.

**Billedraten siger intet om telefoner:** Headless Chromium tegner WebGL i software (SwiftShader) i fuld opløsning. Billedraten er derfor ikke et mål for en Android-telefon. Rigtige tal kræver en test-APK på en fysisk enhed (M4).

**Konkrete optimeringsmuligheder** (dokumenteret, ikke implementeret):
1. **Indlæs 3D-modellerne først ved 3D-kamp.** 2,73 MB af app-HTML'ens 5,49 MB er de to GLB-modeller som base64. De parses ved hver opstart, også uden 3D. Som separate filer i `native-web/` kunne app-HTML'en blive ca. halvt så stor. Det ændrer indlæsningsmetoden og kræver godkendelse.
2. **Kun én model pr. grafikvalg.** Lavdetaljemodellen (0,68 MB) og højdetaljemodellen (1,37 MB) indlæses begge.
3. **Opstarten domineres af at parse ét stort script.** Med 4× CPU tager det ca. 2,9 s, før loginformularen er synlig. Mulighed 1 er det største enkeltskridt.
4. **3D-start** (4–7 s her) bør måles på en rigtig telefon, før der optimeres.

### Serverpakken (`npm run bundle:report`)

`dev/bundle-report.mjs` viser serverpakkens dele. `tests/bundle-budget.test.mjs` fejler, hvis:
- hele pakken overstiger 9,4 MB komprimeret, eller
- en enkelt del vokser mere end 5 % i forhold til `tests/bundle-baseline.json`.

Efter en bevidst, godkendt ændring opdateres referencen med `node dev/bundle-report.mjs --update-baseline`.

Aktuelt: 16,27 MB ukomprimeret og 9,04 MB komprimeret. Den dokumenterede grænse er 10 MiB, men **den er ikke bekræftet**. Der er 1,45 MB (13,8 %) luft.

| Del | Komprimeret | Andel |
|---|---|---|
| 4K-billeder til hjemmesiden | 6,28 MB | 69 % |
| Spillets web-HTML (/play) | 2,18 MB | 24 % |
| Hjemmesidens HTML | 0,32 MB | 4 % |
| Hjemmesidens illustrationer | 0,19 MB | 2 % |
| Serverkode og øvrigt | 0,06 MB | 1 % |

**Risiko:** Lyd, flere modeller eller nye 4K-billeder kan få den næste server-deployment til at fejle. Den største lettelse ville være at hente 4K-billederne fra R2 i stedet for serverpakken. Det er en beslutning om hosting, som kræver ejerens godkendelse.

## Android-testapp "Touchline TEST" (M4)

Byggevarianten `touchlineTest` i `android/app/build.gradle` laver en separat testapp:

| | Touchline Football Idle (APK 37) | Touchline TEST |
|---|---|---|
| App-id | `dk.touchline.footballidle` | `dk.touchline.footballidle.test` |
| Navn på telefonen | Touchline Football Idle | Touchline TEST |
| Version | 1.0.0 (37) | 1.0.0-test (37) |
| Server | Produktionsserveren (uændret) | Kun en separat testserver (`-PtouchlineTestApi`) |
| Signering | Eksisterende nøgle (uændret) | Separat lokal testnøgle |
| Logo, ikoner, design og spil | – | Uændret, kun navnet er ændret |

Fordi app-id'et er forskelligt, installeres testappen **ved siden af** APK 37. Den kan aldrig opdatere eller overskrive APK 37, og den har sit eget login og sine egne data på telefonen.

### Isolering fra produktion

- **Ingen fast adresse i broen:** Produktionsadressen står ikke længere fast i `TouchlineApiPlugin.java`. Den kommer fra `BuildConfig`. Produktionsvarianterne (release, sideload og debug) får præcis den samme adresse som før fra `defaultConfig`.
- **Gradle-spærre:** Bygningen af testappen stopper, hvis `touchlineTestApi` peger på en produktionsvært eller ikke er https. Spærrelisten står i `touchlineProductionMarkers` i build.gradle og i `TouchlineEndpoint.java`, og den dækker Sites-værterne og hjemmesidens domæne.
- **Java-spærre:** `TouchlineEndpoint.java` giver ingen adresse til testappen, hvis den alligevel er produktionslignende. Broen afviser så alle kald, før der åbnes en forbindelse.
- **Standardadresse:** Uden en godkendt testserver peger testappen på `https://touchline-test.invalid`. Den adresse kan aldrig nås, så appen viser blot forbindelsesfejl.
- **Tests:** `tests/android-test-variant.test.mjs` kontrollerer, at
  - produktionsvarianterne har uændret app-id, version, server og signering,
  - testvarianten har eget app-id, navn, nøgle og server,
  - spærrelisterne i Gradle og Java er ens, og Java-spærren er afprøvet,
  - testnøglen er separat og privat,
  - ingen nøgler er sporet i Git,
  - APK 37 er uændret.
- **Uændret brotest:** `tests/native-bridge.test.mjs` afprøver fortsat produktionsbroen med den uændrede produktionsadresse.

### Testnøgle

```sh
npm run android:test-key
```

Kommandoen opretter `.dev-data/android/touchline-test.jks` og et lokalt kodeord. Begge har filrettigheder 600 og ignoreres af Git. En eksisterende testnøgle overskrives aldrig, og produktionsnøglen bruges aldrig.

### Bygning (når miljøet tillader det)

```sh
npm run android:test-key
npm run android:test-apk -- -PtouchlineTestApi=https://<godkendt-testserver>
```

APK'en lægges i `android/app/build/outputs/apk/touchlineTest/`.

**Status:** Bygningen er **ikke mulig i Claude-miljøet lige nu**. Netværkspolitikken blokerer `dl.google.com` (HTTP 403), som leverer både Android SDK og Googles Maven-lager med Android Gradle-pluginet. JDK 21 og Gradle 8.14.3 findes. Bygningen er afprøvet til konfigurationstrinnet, som stopper ved den blokerede adresse.

### Installation på Android (når en test-APK findes)

1. Åbn APK-filen på telefonen, fx fra Claude-appen eller Filer.
2. Tillad installation fra den app, når Android spørger ("Installer ukendte apps").
3. Tryk **Installer**. "Touchline TEST" vises ved siden af "Touchline Football Idle".
4. Log ind med en testkonto, fx `test3@touchline.invalid` / `Touchline-test-3`. Det virker kun, når testappen er bygget mod en testserver med disse konti.
5. Afinstallér: tryk længe på ikonet "Touchline TEST" og vælg **Afinstaller**. APK 37 påvirkes ikke.

## Forhåndsvisning i Claude-appen

Claude-appens forhåndsvisning går gennem en https-proxy. Testserveren bestemmer browserens adresse ud fra `X-Forwarded-Host`/`X-Forwarded-Proto`, `Forwarded` eller `Origin` på samme vært. Derfor virker spillets egen beskyttelse mod forespørgsler fra fremmede adresser uændret, og login lykkes gennem proxyen. `tests/dev-preview.test.mjs` afprøver login, indlæsning og gemning gennem en simuleret https-proxy og kontrollerer, at fremmede adresser stadig afvises.

Alle forespørgsler logges i `.dev-data/requests.log` med metode, sti, status og de adresse-headere, proxyen sendte. Loggen indeholder aldrig cookies, adgangskoder eller forespørgselsindhold. Hvis login fejler i forhåndsvisningen, viser loggen hvorfor.

## Begrænsninger

- **Kun webudgaven:** Testmiljøet kører webudgaven af spillet (`/play`), ikke Android-appen. En test-APK med eget app-id er en senere opgave (M4).
- **Ingen mails:** Mailafsendelse er ikke slået til, og nulstilling af adgangskode via mail virker derfor ikke lokalt.
- **Lanceringslåsen gælder stadig for APK-download.** Den lokale webudgave viser `/play` uanset lanceringstidspunktet, ligesom den eksisterende `web:draft`.
