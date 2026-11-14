# Claude — bevaring af Touchline 37-spillet

Denne fil er overdragelsesdokumentation til en udviklingskopi. Den giver ikke tilladelse til ændringer eller udgivelse. Brugeren har udtrykkeligt låst både hjemmesidens design og spillets eksisterende gameplay. Ændringer kræver brugerens udtrykkelige godkendelse.

## Baseline og bevaringsregler

- App: Touchline Football Idle fra OPNext Games.
- Version: `1.0.0`, Android `versionCode 37`, kampmotor `10`.
- Produktionsbaseline: commit `c71fbb7b617e95f23c737dc5a9fc7fc0a206430e`.
- Hjemmeside og spil deler ét oprindeligt monorepository; de er ikke to uafhængige applikationer. Bygningen genererer både native app, webspil, offentligt marketing-/supportinterface og Worker.
- Arbejd kun på den nye private udviklingskopi. Forbind den ikke til produktion, aktiv Sites-branch, produktionsdatabase, DNS eller domæne.
- Ingen automatisk deployment, migration mod produktionsdatabase, ændring af den eksisterende APK eller upload af nøgler/tokens.
- Produktionsbaseline skal holdes adskilt fra lokale ikke-udgivne ændringer. Se hovedrapporten for disse arbejdsfiler. Eksisterende dokumenter kan beskrive ældre udgaver; baselinefiler og versionsmetadata har forrang.
- Hverken ældre motorer 1–9 eller motor10 må omskrives under backupopgaven. Bevaring af motorversionerne er nødvendig for at kunne genafspille igangværende optagelser korrekt.

## Arkitektur

`src/` indeholder React 19-skærmbilleder, CSS og Three.js-rendering. `src/App.jsx` samler konto, navigation og spilhandlinger. `src/api.js` bruger same-origin API i webvisningen og Capacitors native API-plugin på Android.

`shared/arcade.js` vælger den deterministiske kampmotor ud fra kampens version. Version10 ligger i `shared/football-goals.js`; versionerne 1–9 ligger fortsat som egne moduler. Klientens inputoptagelse og serverens genafspilning bruger samme motor og seed.

`worker/` indeholder Cloudflare Worker-API, kontohåndtering, klubtilstand, økonomi, turneringer, spillerkarriere og validering af manuelle kampe. Spiltilstand gemmes pr. konto i D1/SQLite. R2 bruges til godkendte distributionsartefakter. Disse data er eksterne til kildekoden.

`android/` er en Capacitor 8.6.0-app med Java-bridge, sessionshåndtering og native skærmstyring. React-appen pakkes fra den genererede `native-web/`-mappe. Manifest og `MainActivity` låser hele appen til `sensorLandscape`.

`build.mjs` bundler med esbuild og producerer `native-web/`, genererede JavaScript-moduler samt `dist/server/index.js`. Disse outputs erstatter ikke de originale React-/Worker-/shared-kildefiler. `drizzle/` indeholder SQL-migreringer, ikke en kopi af den aktive database.

## Eksisterende funktioner, der skal bevares

- Kontooprettelse, login, kontohåndtering, kontoafgrænset spiltilstand, gemning og genoptagelse.
- Klubnavn, klubmærke, farver, trøjemønstre, visuel klubidentitet og stadionvisning.
- Idleindtægt/offlineoptjening, saldo, stadion-, sponsor- og træningsopgraderinger.
- Trup, formationer, startellever og reserver, spillerkøb/-salg, transferfiltre, individuel træning og potentiale.
- Akademi, talentforløb, graduering til reservebænken, personale, fans, omdømme, billetpriser og fankampagner.
- Klubbens DNA, forskningspoint/-forløb/-bonusser og bestyrelsesaftaler.
- Ligaer, sæsoner, oprykning, licenskrav, stigende modstand og sæsonarkiv; gamle sæsoner beholder deres oprindelige regler.
- Sæsonpokalen og den opdigtede Aurora Europa Cup med gruppe- og knockoutforløb.
- Managerrejse, mål, karrierefremskridt og belønninger.
- Spillerkarriere med position, attributter, træning, klubskifte, kontraktrolle, kampplan, form, restitution og sæsonmål.
- Simulerede kampe samt spilbare 11 mod 11-kampe i klub- og spillerkarriere.
- Manuel kamp: to 120-sekunders halvlege, 10 sekunders pause, joystick/tastatur, aflevering, stikning, skud/tackling, sprint og finte.
- Taktik og formation kan ændres under den manuelle kamp. Simple indkast, hjørnespark og målspark sættes op af motoren.
- Boldkontakt, erobringer, målmandsreaktioner, målsekvens med netkontakt/afbremsning, kort fejring, scorer/assist og kickoffovergang.
- Replays af faktisk optagede måløjeblikke, radar, energivisning, kampstatistik, kamera- og grafikvalg samt enkel grafikfallback.
- Lokal inputoptagelse og genoptagelse, gemmerecovery på op til 24 timer, serverens deterministiske resultatvalidering og idempotente belønninger.

Dette er et inventar over implementeret kode, ikke en påstand om fuld realisme, fejlfrie telefoner eller fuld produktionsgendannelse.

## Vigtigste filer

| Område | Filer |
|---|---|
| App og konto | `src/App.jsx`, `src/AppChrome.jsx`, `src/AppOrientationGate.jsx`, `src/api.js`, `src/AuthScreen.jsx`, `worker/auth.js` |
| Kampmotor | `shared/arcade.js`, `shared/football-goals.js` og alle ældre motorfiler |
| Input og gemning | `src/manual-session.js`, `src/manual-save.js`, `src/manual-preferences.js`, `worker/manual.js` |
| Kampvisning | `src/ManualMatch.jsx`, `src/manual-scene.js`, `src/match-camera.js`, `src/match-prediction.js`, `src/match-quality.js` |
| Mål og replay | `src/GoalMoment.jsx`, `src/goal-hud.js`, `src/goal-presentation.js`, `src/goal-replay.js` |
| Spillere og stadion | `src/pro-player.js`, `src/player-grounding.js`, `src/player-rendering.js`, `src/pro-stadium.js`, `src/pitch-details.js`, `src/stadium-crowd.js`, `src/stadium-layout.js` |
| Klub og udvikling | `worker/game.js`, `worker/management.js`, `worker/progression.js`, `worker/competition.js`, `worker/expansion.js`, `worker/clubstyle.js` |
| Karriere og turneringer | `worker/player-career.js`, `worker/player-journey.js`, `worker/career.js`, `worker/objectives.js`, `worker/europe.js` |
| Bygning | `build.mjs`, `package.json`, `package-lock.json`, `capacitor.config.json`, `android/` |
| Kontrol og historik | `tests/`, `scripts/`, `release/MATCH37-REVIEW.md`, `release/downloads/current.json` |

Den detaljerede ressourceoversigt med filstørrelser og SHA256 findes i `reports/game/inventory.json` i det samlede backupmateriale. De supplerende originale authoringfiler er beskrevet i `reports/game/EXTERNAL-ASSETS.md` og `reports/game/external-assets-inventory.json`.

## Design og aktiver

Bevar mørkeblå baggrund, limegrøn accent, det nuværende Touchline-mærke, kort, navigation, typografi og bredformatlayout. Den native baggrund er `#0b141d`. Foretag ingen nyfortolkning af designet.

- `assets/game/football-pro.glb` og `football-auto.glb` er de eksisterende high-/lowdetailspillere. Begge er GLB 2 med 13 meshes og 1 skin, uden eksterne buffer-/billed-URI'er. De er kontrolleret som læsbare GLB-filer i denne gennemgang.
- `assets/game/football-motion.json` indeholder bagte spor: idle, walk, run, strafe_left, strafe_right og cheer. Det betyder ikke, at alle spor bruges af den nuværende renderer; de skal alle bevares.
- `football-pro-bones.json`, `footballer.webp` og `portraits.webp` skal med. Stadion, trøjemønstre, bold, tilskuere, markeringer og effekter indeholder også proceduregenereret geometri/tekstur i kildekoden.
- Skrifttyperne DM Sans og Barlow Condensed samt deres SIL Open Font License-filer findes i `assets/fonts/`.
- `assets/game/FOOTBALL-ASSET-LICENSES.md` beskriver MakeHuman/CC0-oprindelse, Ara3D-generatorens MIT-notice og CMU-motiondata. Bevar filen sammen med `release/THIRD-PARTY-NOTICES.txt`.
- Ingen lydfiler med endelserne mp3/wav/ogg/aac/m4a/flac blev fundet i de gennemgåede aktiver. `src/MatchExperience.jsx` har en enkel proceduregenereret WebAudio-tone i simulationsvisningen. Den manuelle kamp har ikke et komplet lydsystem.
- Redigerbare originalprojekter er fundet uden for hovedrepositoryet i `/workspace/football-asset-research/`: fem Blender-/Blenderbackupfiler, rå GLB-eksporter, parametre, optimeringsscripts, bagte motiondata og en lokalt tilpasset Ara3D-generator. De bevares i backupen under `backup-records/external-assets/football-asset-research/` med oprindelige relative stier. Se `EXTERNAL-ASSETS.md` og `external-assets-inventory.json`; udvalget er 902 filer/120.566.112 bytes før komprimering. Generatorens to lokalt ændrede garmentfiler og ikke-versionerede motioneksportscript skal også med.

## Bygning på en isoleret kopi

Brug kun en separat kopi med lokale testdata. Den eksisterende bygning brugte Node 24 og JDK 21; tests bruger `node:sqlite`. De præcise JavaScript-afhængigheder låses af `package-lock.json`.

```sh
npm ci
npm run build
npm test
npm run release:check
```

Disse kommandoer skriver genererede filer i den mappe, hvor de køres. Kør dem aldrig i den originale mappe som del af denne backupopgave. Hvis netværk eller pakker mangler, rapportér den konkrete blokering og bevar kildekoden uændret.

Androidkonfigurationen bruger Gradle 8.14.3, Android Gradle Plugin 8.13.0, compile/target SDK 36 og minimum SDK 24. Gradle-wrapperens JAR/properties og hele Androidkilden skal bevares. JDK, AndroidSDK, downloadede Maven-/Gradlepakker og node_modules er værktøjs-/afhængighedsinstallationer; deres deklarationer er ikke ensbetydende med, at en fuld offlineværktøjskæde er med i backupen.

Kun efter særskilt tilladelse til en ny build i udviklingskopien:

```sh
npm run android:sync
cd android
./gradlew assembleSideload
```

`android:sync` regenererer og kopierer webindhold til Androidkopien. En almindelig release-AAB kan være usigneret. Ingen af disse handlinger må udgive noget eller kobles automatisk til den aktive hjemmeside.

## APK og signering

Den eksisterende `release/downloads/Touchline-1.0.0.apk` er et kompileret produkt og må ikke fremstilles som fuld original kildekode.

- Version 37, filstørrelse 5.236.261 bytes.
- SHA256: `b3da8abedb4c96072d0b876ebf4e8bf5dc04c9f1e742c2ca886ff997b60726a0`.
- APK'ens ZIP/CRC er læst og kontrolleret uden ændring; hash matcher `current.json`.
- Historisk verificeret certifikat-SHA256: `968e6554f40e6cdc7e134c731c3ec42402c3fb9181f3e015b614da7d81d0204b`. Certifikatet er ikke genverificeret af denne dokumentationsagent; se hovedrapportens samlede kontrol.

Private signeringsnøgler og adgangskoder må ikke ligge i GitHub, ZIP-filer eller denne dokumentation. Den eksisterende sideloadapp bruger den tidligere oprettede signeringsidentitet. En ny standarddebugnøgle giver ikke en kompatibel opdatering. Nøglen skal bevares særskilt i en sikker ejerstyret løsning og gendannes ved en fremtidig godkendt opdatering; signeringskonfigurationen i `android/app/build.gradle` håndhæver allerede, at den eksisterende store skal findes.

## Gemte data uden for kildekoden

Konti, sessions, klubtilstande og andre produktionsposter ligger i den aktive D1-database. APK-objekter ligger i R2. Enhedens sessionsmateriale og endnu ikke afleverede inputoptagelser kan ligge lokalt i Androidappens beskyttede lager/WebView-localStorage. Kildekode og SQL-migreringer indeholder ikke disse aktuelle data.

Androidmanifestet har `allowBackup=false`. Antag derfor ikke, at en almindelig Android-/Googlebackup indeholder appens lokale data. Udtræk aldrig nøgler eller kontodata til de private kode-repositories. En separat, adgangsbeskyttet database-/objektbackup skal planlægges og verificeres med platformens understøttede skrivebeskyttede eksport. Manglende eksport skal fremgå som en begrænsning i hovedrapporten.

## Kendte begrænsninger og kontrolstatus

- Den historiske baselinekørsel bestod 486 automatiske tests. Begge 250-sekunders liveforløb for klub-/spillerkarriere og belønning én gang blev tidligere verificeret. Dette er tidligere releaseevidens, ikke en ny test udført af denne dokumentationsagent.
- Fysisk Android-FPS, varme, GPU-kompatibilitet og touchforsinkelse er ikke dokumenteret målt.
- Manuel kamp har ikke offside, frispark/kort, liveudskiftninger eller komplet kamplyd. Simple dødbolde findes.
- Almindelige klubspillere bruger i høj grad en samlet holdrating i kampmotoren. Dedikerede skud-/tackle-/målmandsanimationer er enklere procedurlag over de bagte bevægelsesspor.
- De aktuelle 4K-marketingbilleder er reelle optagelser af den fælles webvisning, ikke skærmbilleder fra en fysisk Androidenhed.
- Aktuel produktion kan ikke erklæres fuldstændigt gendannelig alene på baggrund af kildefiler/APK: runtimehemmeligheder, signeringsidentitet, dataeksport, værktøjskæde og buildkontrol er særskilte forudsætninger.

Bevar alle eksisterende funktioner og ressourcer. Fremtidige forbedringer er ikke godkendt gennem dette dokument.
