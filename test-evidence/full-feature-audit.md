# Teknisk funktionsgennemgang — Touchline 37

15. november 2026. Gennemgangen bygger på den eksisterende M5-kilde og testfiler i
udviklingskopien. Den er ikke en ny fysisk Android-godkendelse. Rodagenten integrerer
samtidig performanceændringer og en bagudkompatibel motor 11-revision.

## Eksisterende arbejde, der bør bevares

| Område | Implementeret i koden | Relevant testgrundlag |
|---|---|---|
| Konto og login | Registrering, normaliseret mail, saltede passwordhashes med pepper, login, separate sessions, udløb, logout, ratebegrænsning, sletning, password-/mailændringer og engangskoder | `worker/auth.js`; `tests/auth.test.mjs`, `tests/native-bridge.test.mjs` |
| Lagring | Kontoafgrænset D1/SQLite-klubtilstand, versionskontrol ved samtidige opdateringer og vedvarende sessions | `worker/index.js`; `tests/api.test.mjs`, `tests/restart-flow.test.mjs` |
| Offline og manuel recovery | Offlineindtægt op til otte timer, lokal inputoptagelse, genåbning, 24 timers uploadrecovery for nyere kampe, kanonisk serverack før lokal optagelse slettes | `src/manual-session.js`, `src/manual-save.js`, `worker/manual.js`; `tests/manual-save.test.mjs`, `tests/manual-api.test.mjs` |
| Manuelle kampe | 11 mod 11, joystick/tastatur, skud, aflevering, stikning, sprint, finte, målmand, boldkontakt, simple indkast/hjørnespark/målspark, to 120-sekunders halvlege og 10 sekunders pause | `shared/football-engine11.js`, `src/ManualMatch.jsx`; motor-/kontakt-/forsvarstests |
| Taktik | Formationer og taktik uden for kampen samt optagede taktiske kommandoer under nyere manuelle kampe | `worker/management.js`, `shared/football-tactics.js`; `tests/football-tactics.test.mjs` |
| Klub og trup | Klubnavn, mærke, trøjer, startellever, reserver, positionsstraffe, spillerkøb/-salg og individuel træning | `worker/game.js`, `worker/management.js`, `worker/clubstyle.js`; management-/clubstyle-/features-tests |
| Akademi og økonomi | Talentforløb, graduering, akademiniveauer, ansatte, sponsor-/stadion-/træningsniveauer, billetpriser, fans, omdømme og fankampagner | `worker/management.js`; `tests/management.test.mjs` |
| Klubcenter | DNA, forskningspoint, forudsætninger, forskningstider, bonusser og bestyrelsesaftaler med kontrollerede belønninger | `worker/expansion.js`; `tests/expansion.test.mjs` |
| Liga og turneringer | Ni liganiveauer, sæsoner, oprykningslicenser, stigende modstand, sæsonarkiv, sæsonpokal og Aurora Europa Cup med gruppe-/knockoutforløb | `worker/competition.js`, `worker/europe.js`; competition-/europe-/progression-tests |
| Spillerkarriere | Positioner, udviklingspoint, attributter, træning, kontraktroller/klubskifte, personlige mål, form, energi, restitution, kampe og sæsonhistorik | `worker/player-career.js`, `worker/player-journey.js`; player-career-/player-journey-tests |
| Mål og statistik | Reelle optagede målreplays, målovergang, skud/afleveringer/besiddelse/tacklinger/redninger samt spillerkarrierens bidrag | `src/goal-replay.js`, `src/MatchStatistics.jsx`; goal-replay-/match-statistics-tests |
| Grafik og skærmformat | Grafikvalg, kameraer, enkel fallback, brede layouts og native `sensorLandscape` | `src/manual-preferences.js`, `src/manual-scene.js`, Android-manifest; preferences-/orientation-/clarity-tests |

Kontrakterne ovenfor er spillerkarrierens kontraktroller samt bestyrelsesaftaler.
Der blev ikke fundet en komplet model for individuelle klubspilleres løn,
kontraktvarighed og forhandling. Markedets køb er implementeret, men er ikke et
komplet kontraktforhandlingssystem.

## Konkrete fund og deres status

### Rettet i denne delopgave: testskærme lovede ikke-understøttede handlinger

Den isolerede Android-testadapter tillader kun login/logout/me/capabilities/game.
Den afviser med vilje registrering, mailnulstilling, kontoændringer, sletning og
kontakt. Det beskytter testmiljøet og er ikke bevis for, at funktionerne mangler i
den almindelige backend.

Før rettelsen viste `src/AccountSettings.jsx` alligevel en aktiv passwordformular og
teksten »Du kan stadig ændre adgangskoden«. `src/AuthScreen.jsx` viste registrering
og sletlink, mens kontakt- og sletskærmene også viste formularer, der blev afvist.

Rettelsen omfatter `src/account-access.js`, `AuthScreen.jsx`, `AccountSettings.jsx`,
`DeleteAccount.jsx` og `ContactScreen.jsx`. Kun en eksplicit testmarkør eller det
kompilerede testflag gør skærmene til testvisninger med forklaring uden formularer.
Ældre/normale servere uden markøren beholder deres eksisterende funktioner. En kendt
testmarkør glemmes ikke ved efterfølgende capability-fejl. Den kendte testbuild
springer unødvendig capability-hentning over på disse skærme.

**Verificeret lokalt:** syv nye tests via `scripts/test-account-access-ui.mjs`
(seks SSR/state-tests og én test af den faktisk kompilerede testmarkør). Derudover
bestod de 15 eksisterende launch/webnavigation-tests og otte management-UI-tests.
Ingen ny browser- eller fysisk Android-test er udført.

Integration i rodagenten kræver `__TOUCHLINE_TEST_APP__:'true'` i testassetbygningen
og capabilities `{testEnvironment:true,registration:false,accountChanges:false}`
fra den isolerede adapter. Det er ikke nye rettigheder i produktionen.

### Fund til rodagenten: en ikke-samarbejdende transport kan ignorere JS-timeout

`src/network.js:withTimeout` afbryder kun transportens signal. Native-transporten i
`src/api.js` anvender ikke signalet; den venter på `NativeApi.request`.
Reproduktion uden netværk/kildeændringer: en transport, der returnerer efter 80 ms,
med `timeoutMs:5` returnerede stadig HTTP 200 efter ca. 113 ms, uden timeoutfejl.

De eksisterende timeouttests bruger en transport, der selv reagerer på abort.
Androidbroens 15/20-sekunders tidsgrænser starter først, når et køelement udføres;
de beskytter derfor ikke alene mod lang ventetid i den serielle native kø.
Rodagenten har fået fundet til særskilt deadline-/cancellationrettelse.

### Kendt performancebegrænsning

`src/manual-session.js` genafspiller hele efterslæbet synkront ved genoptagelse.
Det er nødvendigt at bevare alle input/ticks, men replayarbejdet kan flyttes eller
opdeles, hvis resultatidentitet og gemning testes. At fjerne ticks eller ændre
kampuret ville ændre reglerne og er ikke en sikker performancegenvej.

## Funktioner, som endnu ikke er komplette

- **Offside:** ingen offsideregel; kampens hjælp siger eksplicit »uden offside«.
- **Frispark, kampstraffespark og kort:** ingen komplet forseelses-, frisparks-,
  straffesparks- eller gult/rødt-korttilstand blev fundet i motor 11.
- **Straffesparkslotteri:** findes som serverafgørelse af uafgjorte pokal- og
  europæiske knockoutkampe, med 5–4 eller 4–5. Det er ikke en spilbar sparksekvens.
- **Liveudskiftninger:** reservebytte findes, men `worker/management.js:32–35`
  afviser under aktiv kamp. Det er ikke liveudskiftninger.
- **Kamplyd og kommentarer:** simulationsvisningen har en valgfri tretonet
  målklang. Manuel kamp har ikke et komplet stadion-, bold-, fløjte- eller
  kommentatorsystem. Teksthøjdepunkter findes.
- **Klubspilleres individuelle attributter i kamp:** klubbens kampopsætning bruger
  overvejende samlet holdrating (`worker/game.js:116`, motorens `rating()`), mens
  spillerkarrieren har mere individuel kontrol. Det er en designbegrænsning.
- **Skader:** ingen komplet vedvarende skadesmodel blev fundet. Træthed/energi og
  personlig restitution findes allerede og bør ikke genimplementeres.

## Ikke verificeret af denne audit

Fysisk installation/opdatering på OnePlus Nord 4, Android-FPS, touchforsinkelse,
temperatur, batteriforbrug, GPU-driveradfærd, interaktive visuelle flows og mail-
drift i produktionen. BrowserQA er ikke tilgængelig i dette miljø under den
foreskrevne managed/CUA-arbejdsgang. De eksisterende testfiler er stærk kodeevidens,
men må ikke alene bruges til at erklære alle telefonflows eller spillet færdigt.

Prioritet: lever den allerede igangværende performance-APK/PDF; verificér de
konkrete timeout-/test-UX-/kontaktrettelser; mål derefter på telefonen. De manglende
kampregler kræver versionsafgrænset implementering og deterministiske tests.
