# Codex-gennemgang af Claudes M5, del 2

Dato: 15. november 2026. Dette er en gennemgang og lokal byggetest, ikke en release.

## Fundet udgangspunkt

- Repository: `omarpedersen1997-png/Touchline37-Game` (privat).
- Claudes branch: `claude/m5-del2`.
- Gennemgået commit: `492af990e04e0c3cf7ae466e34b6e4fb5112e052`.
- Sammenlignet med `main`: `e9b04e67d014b544ebe0c383e6b03093277666a1`.
- Claude ligger 9 commits foran og 0 bagud. Ingen genstart eller omskrivning er nødvendig.
- Separat lokal udviklingsbranch: `codex/m5-del2-review`.
- Website-repositoryet har ikke denne Claude-branch og er ikke ændret.

De ni commits omfatter lokalt testmiljø (M1), frosne motorer og visuelle referencer
(M2), versionsstyring/netværksstabilitet (M3), Android-testvariant (M4) samt den
eksperimentelle motor 11 og dens lokale adapter/kalibrering (M5, del 1–2).

## Bevaring

Alle ti oprindelige motorfiler og `release/downloads/Touchline-1.0.0.apk` er
byte-identiske med `main`. Bevaringstests og deterministisk genafspilning består.
De eksisterende kampvisningsfiler `src/ManualMatch.jsx` og `src/manual-scene.js`
er ligeledes uændrede mod `main`.

APK 37 har fortsat SHA-256:

```
b3da8abedb4c96072d0b876ebf4e8bf5dc04c9f1e742c2ca886ff997b60726a0
```

Der er ikke foretaget merge, deployment eller ændringer af den aktive hjemmeside,
produktionsdatabase, DNS, hosting, APK 37 eller produktionssigneringsnøglen.
Originalens lokale, ikke-udgivne arbejdsfiler er ikke anvendt eller overskrevet.

## Verificerede tests

Alle **572 tests** i den eksisterende `npm test`-kæde består: 492 før den nye
Android-varianttest, variantens 10 tests og de efterfølgende 70 tests. Ingen
eksisterende test, forventning, motorfil eller spilfunktion er ændret.

Bygning af den almindelige Worker, web-draft og den lokale motor 11-adapter består.
Motorversioner, legacy-replays, lokal database, preview-login, produktionsspærrer,
netværksgenforsøg, baselineinventar og pakkestørrelsesgrænser er blandt kontrollerne.

Første kørsel stoppede i Android-varianttesten på grund af manglende `javac` i
PATH samt sandboxens `EPERM` ved underprocessers stdin. De 10 tests blev genkørt
med JDK 21 i PATH og uden den pågældende sandboxbegrænsning; alle bestod. Resten
af den oprindelige kommandokæde blev derefter gennemført. Kildekode og tests
blev ikke ændret for at få kontrollerne til at bestå.

Der blev brugt de eksisterende installerede afhængigheder; en frisk `npm ci`
er ikke afprøvet. De 20 visuelle referencefiler består integritetskontrollen,
men der er ikke foretaget en ny pixelsammenligning eller fysisk Android-måling.

## Android-byggetest: består, men endnu ikke en spilbar motor 11-app

Den eksisterende `:app:assembleTouchlineTest` er bygget med JDK 21, SDK 36,
Gradle 8.14.3 og offline-cache. Der er brugt en ny, separat lokal testnøgle.
Delte Capacitor-afhængigheders build-output er omdirigeret til udviklingskopien.

Verificeret i den byggede APK og dens genererede BuildConfig:

| Egenskab | Værdi |
|---|---|
| App-id | `dk.touchline.footballidle.test` |
| Appnavn | `Touchline TEST` |
| Version | `1.0.0-test`, kode 37 |
| API | `https://touchline-test.invalid` |
| Testflag | `TOUCHLINE_TEST_BUILD = true` |
| Størrelse | 5.250.729 bytes |
| APK SHA-256 | `80cbc68cf6b9194560a48c2be8bc68090d2556e387202ac40e1cc30424c8954f` |
| Separat testcertifikat SHA-256 | `bf6991c47983d125ef70a285da1a3cd9c7128f11b1e831a64b21af565abb0069` |

APK-signaturen er verificeret med `apksigner`. App-id og certifikat adskiller sig
fra den bevarede APK 37, så testappen kan ikke installeres som en opdatering af den.
Nøglen og dens kodeord ligger kun i ignoreret `.dev-data/android/`; de er ikke i Git.

**Denne APK er kun et byggebervis. Den er ikke klar til at spille på telefonen.**
`.invalid`-adressen er med vilje utilgængelig. APK'en er derfor ikke udgivet eller
tilbudt som en fungerende motor 11-testapp. Kompilering og en spærret adresse beviser
ikke i sig selv en fungerende isoleret klient/server-forbindelse.

Tre konkrete blokeringer:

1. `src/match-versions.js` bruger fortsat produktionsgrænsen 10. Selv når den lokale
   server annoncerer 11, anmoder den uændrede native klient om 10.
2. Den lokale adapter vælger 11 gennem browsercookien `touchline-dev-engine=11`.
   Android-broen gemmer/sender kun sessionscookien `__Host-touchline`; browserens
   motorvalg overføres derfor ikke til native app. `/dev/*` er ikke en native API-rute.
3. Den eksisterende testserver er HTTP på computerens `127.0.0.1:8787`. Det er
   ikke en verificeret HTTPS-server, som en separat fysisk Androidtelefon kan nå.

Gradle og Java afviser de kendte produktionsværter, og native redirects afvises.
En anden HTTPS-adresse er dog ikke i sig selv bevis for en separat database.
Den konkrete servers data, bindings og netværksadgang skal kontrolleres.
Klubbens manuelle delefunktion indeholder også stadig et produktionslink.

## Vigtig motor 11-fejl fundet

`shared/football-engine11.js:718–732` kan tildele en automatisk takling gennem
duelgrenen uden at opfylde motorens swept-foot-kontaktberegning. Det kan forklare
oplevelsen af at miste bolden uden fysisk berøring.

Deterministisk bevis, uden ændring af motoren:

```sh
node dev/review-m5/reproduce-tackle-contact.mjs
```

Ved seed `poke-17`, tick 20 registreres en takling, mens `sweptContact` er `null`.
Bolden er 1,3303 meter fra den udstrakte fod mod en kontaktradius på 0,26 meter.
Startfixture og beregning er bevaret i `tackle-contact-evidence.json`. Scriptets
nye resultat skrives kun i ignoreret `.dev-data/review/`.

Dette er en diagnostisk reproduktion af den eksisterende fejl, ikke en ny bestået
regressionstest eller en gameplayrettelse. Den eksisterende testsuite opdager
ikke fejlen. Den bør rettes afgrænset i motor 11 med en relevant regressionstest,
når gameplayarbejdet er godkendt.

## Hvad der ikke er dokumenteret færdigt

M5 indeholder ny boldfysik, hold-AI, målmandslogik, skærmning, AI-sprint og
taklingsdueller, men ikke et bevis for realistisk balance eller stabil Android-FPS.
Claudes kalibrering angiver cirka 1,5 gange motor 10's CPU-forbrug og 81 %
botsejre ved lige hold. Det er simuleringsmålinger, ikke fysisk telefonperformance.
Offside, frispark, kort, liveudskiftninger og et komplet kamplydsystem er fortsat
ufærdige. Der er ikke tilføjet erstatninger for disse funktioner.

## Sikker fortsættelse og Android-arbejdsgang

1. Fortsæt fra denne udviklingsbranch og bevar Claudes branch som reference.
2. Etabler en særskilt, godkendt HTTPS-testserver med fiktive konti og egen
   database/lager. Brug aldrig produktionshemmeligheder, bindings eller domænet.
3. Forbind kun testvarianten til motor 11 gennem nativebroen. Bevis login,
   `manual.version === 11`, fuld kamp, gemning og uændrede produktionsversionsregler.
4. Byg derefter en installerbar test-APK. Et privat downloadlink på GitHub skal
   være nok på Android; ingen lokal computer eller kommandolinje bør kræves af ejeren.
5. Mål FPS, varme, touch og kampgemning på ejerens telefon, og ret derefter de
   aftalte motor 11-fejl. Ændr ikke motor 1–10 eller det låste design.

Ingen automatisk merge, deployment eller forbindelse til den aktive hjemmeside.
Denne gennemgang giver ikke en ny godkendelse til produktionsændringer.
