# TEST51 – Motor 11 revision 3 og samlet finish

Udgangspunkt: TEST50 på separat udviklingsbranch. Offentlig playtouchline.dk, APK 37, afleverede APK'er/PDF'er, motor 1–10 samt motor 11 revision 1 og 2 bevares. Kun det særskilte testmiljø må få revision 3.

## Arkitektur og faktisk status

- `shared/`: deterministiske, versionerede motorer; `football-engine11-r3.js` er en særskilt revision, med små fælles matematikfunktioner i `football-motion-r3.js`. Der anvendes faste 50 ms-fysikticks og samme inputcodec som før. Simulationen kører lokalt i klienten og genafspilles på serveren; en Cloudflare Worker er backend, ikke en separat browser-simulationstråd.
- `src/`: React-navigation, Three.js-/2D-visning, kamera, HUD, lokale indstillinger og optagelser. Renderingen bruger rAF og prediction, adskilt fra autoritative fysikticks.
- `worker/`: konti, økonomi, progression, gemning, CAS/idempotens og kanonisk replay. Eksisterende køb/salg, træning, XP, licenser, liga/pokal/Europa og otte timers idle-belønning bevares.
- `android/`: testidentitet, native API-isolering, systemfilvælger og kampens midlertidige immersive visning. Insets publiceres nu til CSS uden at lægge allerede anvendte native margener til igen.
- `dev/`, `tests/`: særskilt testhost og versionsoversigt, build/isolation, kompatibilitets-, API-, UI- og fysiktests. Test-APK bygges med lokale modeller og uden Three.js på login-stien.
- Website-repositoriet beholder de verificerede TEST50-formular-, countdown-, metadata-, illustration- og linkrettelser. TEST51 tilføjer fælles safe-area-tokens og tilstandsstyling. Publicering af det offentlige site kræver særskilt godkendelse.

## Nye konkrete fund og rettelser

1. R2 modtagelser nulstillede boldens hastighed direkte til spillerens hastighed. R3 dæmper den relative ankomstfart efter teknik, modtagevinkel og pres; en lille del af bevægelsesenergien bevares i førsteberøringen.
2. Den gamle driblekontrol trak med en fast andel mod et fast punkt. R3 bruger kritisk dæmpning og spillerens hastighed med en kort modtagefase; spilleren tager bolden med i bevægelsen.
3. Afleveringstyper delte for meget rulledynamik. R3 skelner pass/through/loft/shot/loose med rulle-/luftmodstand, nedslagsdæmpning og aftagende skru. Fartberegning, modtagerprognose og målmandsprognose bruger samme integration som den faktiske bold.
4. Spilleracceleration og kropsretning skiftede brat. R3 begrænser acceleration, opbremsning, ændringen i acceleration og vinkelhastighed. Løbeprognosen bruger den samme bevægelsesmodel. Animationens eksisterende skridttiming og fodfæste bevares.
5. Afsparkets bold lå 1,2 meter fra midten, og angribere kunne stå på modstanderens halvdel. R3 placerer bolden præcist i (0,0), organiserer den valgte formation på egne halvdele og holder modstandere uden for midtercirklen. Der er 24 rolige ticks (1,2 s), og derefter en åbningsaflevering. Manuelt retnings-/handlingsinput kan overtage efter startøjeblikket. Samme afspark bruges efter mål og ved anden halvleg.
6. Den gamle pro-linse havde ingen fremadrettet indramning. R3 følger bold og nærmeste aktive spiller med begrænset bevægelsesforudsigelse og en analytisk kritisk dæmpet rig. Højden ændres højst 8 %, retningen og kontrollernes koordinatsystem er stabile. Reduceret bevægelse fjerner forudsigelse og dynamisk zoom. Ingen layoutmåling indgår i riggens frame-kald.
7. Afrunding kunne vise 100 % trods reelt registreret modstanderbesiddelse. HUD/statistik viser nu én decimal med dansk komma og bevarer en synlig andel, hvis begge hold har haft bolden. Der fabrikeres ingen hændelser eller 50/50-tal.
8. Automatisk takling blev afgjort på én enkelt kontaktframe. R3 bevarer den fysiske fodkontakt som krav, men tillader kontakt i hele benets eksisterende slagvindue; en allerede afgjort duel rulles ikke igen.
9. Portrætregler kunne overskrive topbarens safe-area-padding. Fælles tokens bruger native overlap eller browserens env-insets. Den native hjælper har oprydning ved Activity-lukning og måler kun ved layoutændringer. Fane-, menu- og modalbund får korrekt luft. Meget lave liggende Hold-skærme ruller naturligt frem for at klippe formationen.
10. Genvejsgitteret havde fem elementer i tre kolonner. En fungerende Mål-genvej giver seks handlinger uden tom hjørneplads. Beløb i topbaren bruger en central dansk formateringshjælper; `kr.` er synligt i begge orienteringer.
11. FINTE var skævt placeret; den flugter nu med STIKNING. Banderne gentager teksten færre gange og stopper inden for banekantens mål.
12. Mållyd var den eneste syntetiske kamplyd. Valgfrit Web Audio-dommerfløjt tilføjes ved afspark, halvleg og slut; blokering/manglende API håndteres, og samme lokale lydindstilling bevares. Genåbning midt i en kamp må ikke udløse et falsk afsparksfløjt.
13. TEST50 indhentede op til 16 inputs pr. draw. Dit nye udtrykkelige krav genindfører højst fire inputs og et 2 ms-arbejdsbudget. Der droppes ingen ticks, og engangshandlinger/kommandoer forbruges først, når den aktuelle inputtid er indhentet. Ved ekstremt lav faktisk FPS kan indhentning tage længere tid; dette skjules ikke med tabte inputs.
14. Det normale billedloft var 60 FPS. Motor 11 kan nu udtrykkeligt vælges til op til 60 eller 120 FPS med en særskilt, versionsmærket lokal indstilling. 60 er standard. Fysisk understøttet skærmfrekvens og faktisk enhedsydelse bestemmer det opnåelige resultat.

## Bevidste størrelses- og kompatibilitetsvalg

Revision 2 ændres ikke byte for byte. R3-kopien er nødvendig for at bevare gamle optagelser. Den bevidste kodevækst registreres i bundle-baseline, mens 5 %-vækstvagten og de absolutte pakkestørrelsesgrænser bevares. Der tilføjes ingen modeller, teksturer, videofiler, netværksafhængigheder eller tredjepartsbiblioteker.

Native TEST51 beder eksplicit om revision 3 og verificerer testmiljøets attest før login. Serveren bevarer revision 2-attesten til gamle klienters header og vælger kun R3 efter den nye header. Produktionens standardmotor ændres ikke. Testserverens eksisterende schema og fiktive konti må ikke nulstilles.

## Verificering og afgrænsning

- Regressioner dækker gamle motorer, R2-kontrolsum, tre komplette 5.000-inputsforløb mellem Node og Chromium samt præcis sluttilstand/codec i klient, server og fire-inputs-indhentning.
- Nye fysiktests dækker rullemodstand, luftkurver, spin/nedslag, førsteberøring, acceleration/opbremsning, midterafspark, stolpe/overligger/mål og afspark til det indkasserende hold.
- Kameradæmpning sammenlignes ved 30/60/120 Hz. En sådan matematisk test dokumenterer ikke fysisk telefon-FPS.
- De tidligere 4 FPS-fejl i adaptiv opløsning er rettet i TEST50 og bevares. Software-WebGL og Node-timings er ikke målinger af OnePlus Nord 4. 60–120 FPS, berøringsforsinkelse, varme, batteri og faktiske systembjælker/notch kræver fysisk telefonkontrol.
- Vedvarende managerform/skader/karantæner og komplette offside-/frisparks-/straffe-/kort-/udskiftningsregler er fortsat versionerede mangler. Personlig energi, restitution, træning og øvrigt eksisterende kerne-loop fungerer fortsat efter deres eksisterende regler.
- Pause/hastighed gælder målreplay. Den aktive servervaliderede kamp kan ikke pauses eller fremskyndes med en visningsknap.
- Lokal save-/indstillingsstruktur fra TEST50, splash, lydvalg og testidentitet bevares. Ingen nulstilling af klubdata, ingen import af konti og ingen løfter om nul risiko for datatab.

## Telefon- og desktopkontrol

1. Opdater oven på Touchline TEST uden afinstallation. Bekræft, at klub, splashvalg og lydvalg bevares, og at APK 37 stadig er separat.
2. Se afspark i alle formationer: bolden i midten, roligt kamera og modstandere uden for cirklen. Gentag ved anden halvleg og efter et mål.
3. Mærk efter ved korte afleveringer, hurtige stikninger, løftede bolde og hårde skud: forskellig fart, flyvehøjde, nedslag og førsteberøring.
4. Dribl på tværs og vend hurtigt 90/180 grader. Krop, acceleration, opbremsning og fodfæste skal følge bevægelsen; bolden skal kunne tages med uden teleportering.
5. Følg lange afleveringer og nærkampe i begge TV-kameraer og nærkameraet. Prøv reduceret bevægelse og en 120 Hz skærmindstilling uden at forveksle skærm-Hz med målte FPS.
6. Kontroller faktiske erobringer mod boldbesiddelsestallet. Prøv mållyd/dommerkald og permanent mute samt tilbagevenden fra baggrunden uden falsk afsparksfløjt.
7. Skift til en anden app, vend tilbage, afslut kampen, og kontroller resultatgemning én gang. Hent ydelsesrapport og kampbackup via systemfilvælgeren.
8. Kontroller statuslinje/notch og faner ved 320/360/384/390 px, stående og lavt bredformat. Luk fullscreen og kontroller portrætmenuens top- og bundafstand samt overblik-modalens splashindstilling.
9. Brug tastatur og fokus på desktop. Kontroller knapflader, den nye Mål-genvej og beløb med `kr.`.
10. Kontroller privat hjemmesidepreview: countdown/dato, grafikkanter, reduceret bevægelse, Kontakt/Privatliv/Slet konto og formularens kontrast. Offentlig udgivelse sker først efter særskilt godkendelse.

## Ændrede og nye kildefiler i dette gennemløb

- `android/app/src/main/java/dk/touchline/footballidle/MainActivity.java`
- `android/app/src/main/java/dk/touchline/footballidle/TouchlineApiPlugin.java`
- `android/app/src/main/java/dk/touchline/footballidle/TouchlineInsets.java`
- `dev/android-test-worker.js`
- `dev/test-release.json`
- `docs/LIVING-PLAY-TEST51.md`
- `package.json`
- `shared/arcade.js`
- `shared/football-engine11-r3.js`
- `shared/football-motion-r3.js`
- `src/App.jsx`
- `src/GameLobby.jsx`
- `src/GameNavigation.jsx`
- `src/ManualMatch.jsx`
- `src/MatchLivePulse.jsx`
- `src/MatchSoundControl.jsx`
- `src/format-money.js`
- `src/goal-presentation.js`
- `src/living-camera.js`
- `src/manual-scene.js`
- `src/manual-session.js`
- `src/match-camera.js`
- `src/match-refresh.js`
- `src/match-sound.js`
- `src/match-statistics.js`
- `src/pro-stadium.js`
- `src/stadium-console.css`
- `src/touchline-tokens.css`
- `tests/android-test-worker.test.mjs`
- `tests/bundle-baseline.json`
- `tests/engine11-living.test.mjs`
- `tests/engine11-revision.test.mjs`
- `tests/game-lobby.test.jsx`
- `tests/java/testbridge/dk/touchline/footballidle/TouchlineApiCancelTest.java`
- `tests/java/testbridge/dk/touchline/footballidle/TouchlineTestApiBridgeTest.java`
- `tests/match-statistics.test.jsx`
- `worker/manual.js`
