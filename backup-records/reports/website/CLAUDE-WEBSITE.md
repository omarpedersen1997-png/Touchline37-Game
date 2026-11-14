# Touchline 37 — hjemmeside: bevaring og sikker videreførelse

## Opgavens grænse

Dette er en sikkerhedskopi, ikke en tilladelse til udvikling eller udgivelse. Hjemmesidens eksisterende design og spillets eksisterende gameplay må kun ændres efter brugerens udtrykkelige godkendelse. Arbejd kun i en udviklingskopi. Foretag ingen deployment, databaseændring, DNS-/domæneændring eller ændring af produktionsrepository. Aktivér ingen automatisk deployment. Bevar originale filer og APK uændret.

## Oprindelse og arkitektur

Hjemmesiden https://playtouchline.dk og Android-spillet Touchline 37 deler ét monorepository. Den verificerede produktionsbaseline er commit `c71fbb7b617e95f23c737dc5a9fc7fc0a206430e`, gemt i ChatGPT Sites som version 55. Androidversionen er 1.0.0 med versionCode 37 og kampmotor 10. En separat lokal sikkerhedskopi er ikke en separat oprindelig hjemmesidekodebase.

Frontend bruger React 19 og JavaScript/JSX/CSS. Hjemmesidens indgangspunkt er `src/WebSupport.jsx`; spillets er `src/App.jsx`. `build.mjs` bygger begge indgange med esbuild. HTML, CSS, skrifttyper, illustrationer og udvalgte billeder indlejres i genererede JavaScriptmoduler, som samles i `dist/server/index.js`. Dette er en Cloudflare Worker leveret gennem ChatGPT Sites, ikke en statisk mappe med en oprindelig `index.html`. Hjemmesidens komplette originale React- og CSS-kilde er tilgængelig. Ingen TypeScript-/TSX-filer er fundet i baseline.

**Hele monorepoet skal bevares i denne backup.** Buildscriptet bygger også Android-/webspillet, læser spilmodeller og den eksisterende signerede APK samt validerer dens checksum. En løs kopi af kun hjemmesidens komponenter ville derfor ikke kunne bruge den eksisterende byggeproces uændret. Den separate Game-backup bevarer samme fælles kildefiler med spilrettet dokumentation.

## Eksisterende sider og funktioner

- `/`: forside med navigation, hero, original vektorillustration af bane/trøje, klub-/spiller-/Europa-præsentation, aktuelle 4K-webvisninger, kamppræsentation, strategi/DNA/forskning/klubidentitet, udviklingsrejse, udgivelsesfelt, installationsvejledning og FAQ.
- `/contact`: supportformular med emner, e-mail, samtykke, honeypot, validering og sagsreference. Backend lagrer henvendelsen i D1; eventuel maillevering er separat konfiguration.
- `/privacy` og `/delete-account`: juridiske oplysninger og vejledning om kontosletning.
- `robots.txt`, `sitemap.xml`, favicon og delingsmetadata genereres fra kode.
- `/api/launch`: serverens åbningstid og status. `src/LaunchPanel.jsx` viser nedtællingen og synkroniserer klientens ur med serveren. Netværksfejl åbner ikke spil/download.
- Webspillet `/play` og offentlig APK-download er serverbeskyttet frem til **1. januar 2027 kl. 10 dansk tid**, svarende til `2027-01-01T09:00:00.000Z`.
- Android og web bruger samme konto og backend. Ingen Google Play-udgivelse er godkendt.
- Hjemmesidens responsive CSS, kort, menuer, links, FAQ-udfoldning, illustrationer og typografi findes i kilden og skal bevares 1:1.

## Vigtige kildefiler

- `src/WebSupport.jsx`: alle hovedsektioner, navigation og sidevalg.
- `src/LaunchPanel.jsx`, `worker/launch.js`, `release/launch.json`: nedtælling og serverstyret lancering.
- `src/CurrentGallery.jsx`, `shared/site-capture-policy.js`, `scripts/verify-site-captures.mjs`, `release/site-captures.json`: verificering og visning af aktuelle originale 4K-billeder.
- `src/TouchlineBrand.jsx`, `shared/brand-mark.js`: eksisterende Touchline-logo og favicon.
- `src/ClubStudio.jsx`: trøje-/klubillustrationer, som også bruges på hjemmesiden.
- `src/ContactScreen.jsx`, `src/LegalScreen.jsx`, `src/api.js`: support, juridiske sider og anmodninger.
- `src/site.css`, `src/redesign-site.css`, `src/redesign-auth.css`, `src/forest.css`, `src/forest-site.css`, `src/game-presentation.css`, `src/site-update.css`, `src/current-gallery.css`: stylesheets. Deres eksisterende rækkefølge i `build.mjs` er en del af designet; navne som “forest” betyder ikke, at den aktuelle baggrund må ændres.
- `worker/index.js`, `worker/contact.js`, `worker/auth.js`, `worker/mail.js`: HTTP-ruter og serverfunktioner.
- `assets/site/`, `assets/fonts/`, `assets/game/`, `release/store-assets/`: original grafik, fotos/webvisninger, skrifttyper, 3D-aktiver og udgivelsesgrafik. Bevar også historiske/ubrugte ressourcer som historik, uden at gøre dem til aktive sideaktiver.
- `build.mjs`, `package.json`, `package-lock.json`, `.openai/hosting.json`, `drizzle/`: build, dependencies, hostingbeskrivelse og databaseskema.

## Design og branding — låst

Bevar mørkeblå/slate baggrund, limegrønne accenter, eksisterende kort, illustrationer, logo, navigation og layout. Den indlejrede theme-color er `#0b141d`; limefarven `#c1f66b` indgår i designet. Det endelige udseende bestemmes af samtlige eksisterende stylesheets i deres nuværende rækkefølge; brug ikke en ny palette eller et nyt UI-kit.

Skrifttyperne er lokalt bevarede `assets/fonts/DM-Sans.ttf` og `assets/fonts/Barlow-Condensed.ttf` med deres licenser. Vektorillustrationerne ligger i `assets/site/arena-2.svg`, `kit-2.svg`, `badge-2.svg` og React/SVG-komponenter. Delingsgrafikken er `assets/site/touchline-share.png`.

De fire aktuelle screenshots i `release/site-captures.json` er oprindelige 3840×2160 JPEG-webvisninger bundet til APK 37's SHA256. De er **ikke optagelser fra en fysisk Android-enhed**. Den eksisterende mærkning skal bevares. Billeder må ikke opskaleres eller erstattes af opfundne gameplaybilleder. Ældre 36- og lavopløsningsbilleder er historiske ressourcer og må ikke fremstå som aktuelle.

## Hosting, tjenester og data

Hostingbeskrivelsen er `.openai/hosting.json` med Sites-projektid og bindingsnavnene `DB` (Cloudflare D1) og `BUCKET` (R2). Et originalt projektid i en backup er provenance, ikke tilladelse til at tilslutte eller publicere kopien. Brug ikke Sites-publish, wrangler-deploy, domæneændringer eller produktionscredentials fra denne kopi.

Kendte hostnavne fra kilden er `playtouchline.dk`, Sites-platformens `touchline-idle-club.glowingconch1.chatgpt.site` og den valgfrie mailleverandør `api.resend.com`. Pakkeinstallation og Androidbygning kan kontakte npm-/Gradle-/Google-Maven-tjenester. Brug kun allerede godkendt netværk ved senere arbejde. Der er ingen Analytics-, reklame- eller købspakke i den aktuelle frontendkode.

Databasemigreringerne i `drizzle/` bevarer skemaet, men indeholder ikke produktionsbrugernes konti eller gemte fremskridt. Produktionsdata, R2-objekter og runtime-hemmeligheder skal sikkerhedskopieres særskilt gennem en godkendt eksport. En kodebackup alene beviser ikke fuld driftsgendannelse. Tilføj aldrig adgangskoder, API-nøgler, adgangstokens, sessionsdata eller signeringsnøgler til GitHub eller ZIP-filerne.

## Bygning og tests — kun i en kopi

Node 24 blev brugt i det eksisterende Codexmiljø; testpakken benytter `node:sqlite`. Dependencies er låst i `package-lock.json`.

```sh
npm ci
npm run build
npm run release:check
```

Kør kun disse kommandoer i en udviklings-/testkopi: build genererer `native-web/`, `dist/` og `generated-*.js`, og skal ikke overskrive originalernes genererede filer. Bygning er ikke deployment. `npm ci` kræver netværk eller allerede tilgængelige dependencies; eksisterende dependencies kan anvendes til en isoleret kontrol uden at hævde, at en ny maskines installation er testet.

Relevante hjemmesidekontroller efter build:

```sh
node tests/site-assets.test.mjs
node tests/site-metadata.test.mjs
node tests/site-captures.test.mjs
node tests/launch-gate.test.mjs
node scripts/test-gallery-ui.mjs
node scripts/test-launch-ui.mjs
```

`npm test` omfatter også spillets fulde suite. Testresultater fra baseline er historiske, indtil de er gentaget på sikkerhedskopien. Ingen supportformular eller konto-/spil-API skal afprøves mod produktion under en backup: selv GET af spiltilstand kan beregne og gemme fremskridt. Begræns livekontrollen til ikke-mutérende offentlige dokumenter, statiske aktiver og hosting-/DNS-oplysninger.

## Kendte begrænsninger

- Automatisk adgangskodenulstilling via mail er beskrevet på hjemmesiden som endnu ikke aktiveret; mailintegration afhænger af hemmelige runtimeindstillinger, som ikke må være i backup.
- Kode-/assetintegritet er ikke i sig selv dokumentation for pixelidentisk rendering på alle browsere. En 1:1-kontrol kræver sammenligning med produktionsbaseline ved samme viewport, skrifttyper, data og tidspunkt.
- Nedtælling og kalenderår er tidsafhængige; en senere screenshot kan have andre tal uden en designændring.
- De aktuelle 4K-billeder viser browserrendering af den signerede APK's webindhold, ikke fysisk telefon-FPS eller en fuld enhedstest.
- Lokal kilde kan indeholde ufærdige, ikke-udgivne eksportændringer efter baseline. De skal opbevares separat og må ikke forveksles med aktiv version 55 eller automatisk medtages i produktion.
- En kompileret Worker, HTML eller APK er et nyttigt artefakt, men erstatter ikke original React-/JS-/CSS-kilde, dependencies, assets, data og nødvendig driftskonfiguration.

## Sikker fortsættelse i Claude Code

Læs sikkerhedskopiens integritetsmanifest og bevar den oprindelige mappeopbygning. Opret en ny udviklingsbranch i det nye private backuprepository. Læs og forstå koden før forslag. Indhent udtrykkelig godkendelse før ændring af design, eksisterende gameplay, produktion, data, APK eller hosting. Nye kodeændringer skal kunne gennemgås som en diff og testes lokalt; en succesfuld lokal test er ikke tilladelse til udgivelse.
