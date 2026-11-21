# Touchline – samlet audit og rettelser, TEST50

Dette er en udviklingsudgave fra TEST49. APK 37, motor 1–10, originale motor 11, eksisterende optagelser og produktionsdata bevares. Der er ingen merge til main eller offentlig udgivelse. Lanceringen er fortsat fredag 1. januar 2027 kl. 10.00 i København, dvs. 09.00 UTC.

## Struktur og eksisterende funktioner

| Område | Kilder | Status |
| --- | --- | --- |
| App og navigation | src/App.jsx, GameNavigation.jsx, WorkspaceDeck.jsx, AppChrome.jsx | Eksisterende login, konto, menuer, fane-navigation og klubhandlinger |
| Design | touchline-tokens.css, stadium-console.css, stadium-site.css og øvrige view-stylesheets | Marineblå/lime, fælles overflader, typografi, fokus og reduceret bevægelse; ældre CSS-lag findes fortsat |
| Hold og taktik | SquadPitch.jsx, SquadAnalysis.jsx, worker/management.js, shared/team-strength.js | Startellever/reserver, positioner, træning, potentiale, formation og taktik |
| Kampe | ManualMatch.jsx, manual-session.js, manual-scene.js, shared/football-engine11*.js | Versioneret deterministisk motor, AI, boldkontakt, mål, målmænd, genstarter, målreplay og to halvlege |
| Økonomi/progression | worker/game.js, progression.js, competition.js, europe.js, objectives.js | Transfers, personale, billetter, otte timers idle-grænse, licenser, liga, pokal, Europa, daglige mål og milepæle |
| Personlig karriere | worker/player-career.js, player-journey.js og PlayerCareer.jsx | Egenskabstræning, XP, energi/restitution, kontrakter og progression |
| Gemning/sikkerhed | worker/index.js, auth.js, src/api.js, manual-save.js | Serverlagring, CAS/idempotens, brugeradskillelse og bekræftet kampupload |
| Android | android/, dev/build-performance-assets.mjs | Eget test-app-id/certifikat, lokal 3D-grafik og isoleret testserver |
| Website | src/WebSupport.jsx, LaunchPanel.jsx, ContactScreen.jsx, LegalScreen.jsx, shared/site-metadata.js | Danske offentlige dokumenter, serverbekræftet lancering, metadata, logo, kontakt og rettigheder |

Se også CORE-LOOP-AUDIT.md for eksisterende forbindelser mellem holdstyrke, træning, økonomi og kampstart. Ingen af disse systemer erstattes af lokale kopier af servertilstanden.

## Konkrete fejl og årsager

1. **Auto kunne ignorere vedvarende meget lav FPS.** Frame-intervaller over 250 ms blev behandlet som baggrundspauser. Software-Chromium reproducerede 3–4 FPS med uændret opløsning. Nu accepteres langsomme forgrundsframes; baggrundsskift nulstiller målingen eksplicit.
2. **Auto havde et for højt gulv.** `Math.max(1, …)` forhindrede nedskalering under én pixel pr. CSS-pixel. Motor 11 har nu et budget på højst cirka 1,2 mio. pixels, DPR op til 1,25 og 1920 pixels på den lange led, med yderligere tilpasning ned til halv lineær skala. Sharp/4K og ældre profiler bevares.
3. **Fire inputs pr. frame kunne fastholde efterslæb ved 4 FPS.** Det svarer til højst 16 inputs/s mod motorens 20 inputs/s. Motor 11 får nu højst 16 inputs pr. kald, med et CPU-tidsbudget på 2 ms og kontrol efter hvert input. Et enkelt input kan overskride budgettet; det kan ikke afbrydes midt i et fysiktick. Ingen inputs droppes, og kun det seneste aktuelle input må bruge ny styring.
4. **Visningsarbejde kunne fortsætte ved fane-skift.** En særskilt synligheds-loop annullerer rAF, gemmer optagelsen og nulstiller styringen ved skjul. Genoptagelse indhenter neutral tid i små portioner. FPS-statistik tæller ikke baggrundsventetid. Replayet holder pause i baggrunden.
5. **Opløsningstilpasning læste layout i render-kaldet.** Auto-resize genbruger nu de cachede viewport-mål; kun den faktiske ResizeObserver-opdatering læser layout.
6. **Valutatekst var skjult ved smal bredde.** `kr.` vises nu også på højkant.
7. **Klubnavn blev forkortet unødigt.** Klubværktøjslinjen kan ombrydes, så navn og formation får egen plads. Højkant har ekstra bund-padding. Handlingsknappen Find spillere forbliver på én linje.
8. **Scoretavlen forkortede hele ord med ellipser.** Den bruger nu bevidste klubkoder, fx PRBK/HAIF, mens fulde navne bevares i tilgængelige labels og titler.
9. **Livekortets gennemsigtige baggrund gav visuel støj.** Kortet har nu en dækkende marineblå flade. Minikort og fokusbjælke er samlet nederst på midten.
10. **Kontosletning krævede et ekstra omvejsklik.** Footer-linket går til kontaktformularen med kontosletning valgt og relevant anker. Den selvstændige sletningsvejledning bevares.
11. **Supportens sekundære tekst og placeholders var svage.** Fælles tokens giver højere kontrast, fuld opacitet og læsbar hjælpetekst; beskedfeltet er knyttet til sin tegnvejledning med aria-describedby.
12. **Nedtællingen opdaterede og hentede status i baggrunden.** Skjulte sider foretager nu ikke periodiske React-opdateringer eller nye statuskald. Forgrund giver ny servertid og fuld nedtælling igen.
13. **Lokale optagelser manglede kontrol af regelkonfiguration og utilsigtet korruption.** Nye optagelser har skema, regelidentitet og checksum. Gamle gyldige optagelser migreres ved næste gemning. Ubrugelige data falder tilbage til neutral gendannelse. Serverens replay er fortsat autoritativt; checksummen er ikke kryptografisk sikkerhed.

## Nye anvendelige funktioner

- Valgfri, lokalt gemt mållyd. AudioContext oprettes først efter brugerhandling; skjul og lukning suspenderer/lukker lydressourcer. Syntetisk mållyd er ikke indtalt kommentar eller licenseret stadionlyd.
- Målreplays kan sættes på pause og afspilles ved 0,5×, 1× eller 2×. Den aktive servervaliderede kamp sættes ikke på pause eller fremskyndes.
- Kampindstillinger tilbyder **Hent kampbackup**: JSON med denne kamps konfiguration og inputoptagelse. Det er ikke en backup af hele kontoen, og der er ingen ny import-/overskrivningsfunktion.
- **Hent ydelsesrapport** eksporterer op til 60 reelle måleprøver fra enheden med FPS, frametid, render-kald, trekanter og opløsning. Rapporten udelader konto-, adgangs- og sessionsoplysninger og kan bruges ved næste telefonkontrol.
- Kampoptakten viser holdstyrke og modstanderstyrke fra de eksisterende beregninger samt den valgte kampplan. Ingen modstandernavne eller taktiske egenskaber opfindes.

## Målinger og praktiske grænser

Den isolerede 1008×450/DPR 2,75-test er udført med Chromium og software-WebGL, identisk scene og kamera, otte sekunders målevindue. Før: 24 frames på 8266 ms, gennemsnitligt 359 ms mellem frames; Auto blev på 1512×675. Efter: 40 frames på 8016 ms, gennemsnitligt 206 ms mellem frames; Auto tilpassede ned til 630×281. Begge havde 168 draw calls og 157.156 trekanter i den målte scene. Efterprøver nåede 7–9 FPS. Dette dokumenterer tilpasningen og flaskehalsen i dette miljø, ikke 60 FPS på en Android-telefon.

Målet er fortsat stabilt 60 FPS. En 120 Hz skærm kan bruges, men den aktuelle normale Auto-pacer har et 60 FPS-loft. Fysisk OnePlus Nord 4, 120 FPS, varme, batteri, installation og GPU-tid er ikke verificeret. Render-kaldets CPU-tid er ikke GPU-tid. Ingen garanti om lagfrihed eller udgivelsesklarhed gives ud fra denne browsermåling.

## Hvad mangler reelt stadig?

- Managertruppens vedvarende form, skader, karantæner og rotation er ikke færdigimplementeret. Kampenergi og personlig karriererestitution findes allerede.
- Komplette offside-, frisparks-, straffe-, kort- og udskiftningsregler mangler fortsat i den manuelle motor. Hændelseslisten viser kun målbare motorhændelser.
- Navngivne individuelle modstandere med dokumenterede forskellige spillestile er ikke genereret som om de allerede findes.
- Android-eksport bruger nu den native systemfilvælger uden lagerrettighed eller upload. Den er endnu ikke afprøvet fysisk; touch-ergonomi, rotation og længerevarende FPS skal afprøves på telefonen. Browser-download alene dokumenterer ikke Android WebView-download.
- En klubbackup/-import kræver serverunderstøttelse og konfliktkontrol. Browserens kampbackup må ikke forveksles med denne funktion.
- Offentlig hjemmeside og produktionsbackend er ikke opdateret. Nye backendregler kræver særskilte versioner, migrationer og godkendt miljøudgivelse.
- App.jsx og den eksisterende CSS-kaskade er stadig store. De ændres ikke mekanisk på tværs af projektet under denne fejlrettelse.

## Manuel kontrol på telefon og desktop

1. Installer TEST50 oven på Touchline TEST uden afinstallation. APK 37 skal stadig være separat.
2. Åbn Hold i højkant ved 320/384 CSS-pixels. Kontrollér alle elleve kort, badges, fuldt klubnavn, Find spillere, Trup & reserver og `kr.`. Gentag liggende ved lav skærmhøjde.
3. Start kamp via optakten. Kontrollér styrker og taktik, afspark, boldens læsbarhed, kamera, minikort, fokusbjælke og touchknapper.
4. Brug udvidet visning og gå tilbage. Forlad kampen: menuer skal igen kunne stå lodret.
5. Skift til en anden app i 20 sekunder, og vend tilbage. Styringen må ikke hænge; efterslæb skal indhentes, og optagelsen skal stadig kunne gemmes.
6. Prøv Auto, Sharp og 4K hver for sig. Under Kampstatistik aflæses FPS/opløsning. Hent ydelsesrapport efter mindst et minuts spil, også på en 120 Hz skærmindstilling.
7. Slå mållyd til/fra og genåbn kampen. Kontrollér målreplayets pause/tempo og tilbage til resultat. Hent kampbackup, og kontrollér at filen faktisk kan åbnes på Android.
8. Besøg hjemmesiden i mobil og desktop: fulde countdown-labels, intet tomt hul, synlige knapper/footere og korrekt dato. Test tab/Enter, fokus og reduceret bevægelse.
9. Tryk Slet konto i footeren: kontosletning skal være valgt, og formularen være synlig. Test feltkrav, fejl og kvittering i et isoleret testmiljø; send ikke testbeskeder til produktionen.
10. Kontrollér Privatliv og sletningsvejledning samt kalendergrænsen 1. januar 2027 kl. 09.00 UTC. En klientklokke alene må aldrig åbne download eller webspil før serverbekræftelse.

## Alle ændrede/oprettede kilde- og dokumentationsfiler

- `android/app/src/main/java/dk/touchline/footballidle/MainActivity.java`
- `android/app/src/main/java/dk/touchline/footballidle/TouchlineExportPlugin.java`
- `dev/test-release.json`
- `docs/LAUNCH-AUDIT-TEST50.md`
- `package.json`
- `scripts/test-launch-audit-ui.mjs`
- `src/App.jsx`
- `src/ContactScreen.jsx`
- `src/LaunchPanel.jsx`
- `src/ManualMatch.jsx`
- `src/MatchLobby.jsx`
- `src/MatchSoundControl.jsx`
- `src/WebSupport.jsx`
- `src/download-json.js`
- `src/manual-recording-format.js`
- `src/manual-scene.js`
- `src/manual-session.js`
- `src/match-frame-stats.js`
- `src/match-labels.js`
- `src/match-performance-log.js`
- `src/match-quality.js`
- `src/match-sound.js`
- `src/match-visibility.js`
- `src/replay-playback.js`
- `src/stadium-console.css`
- `src/touchline-tokens.css`
- `tests/launch-audit-ui.test.jsx`
- `tests/launch-audit.test.mjs`
- `tests/website-refresh-ui.test.jsx`

APK, PDF, rå målinger og browserbilleder afleveres under dev/artifacts og test-evidence.
