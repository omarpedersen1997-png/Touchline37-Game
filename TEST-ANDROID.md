## TEST40 — aktuel testudgave

Asynkron gendannelse, synlig fremdrift og beskyttelse af gyldige optagelser. 643 tests bestod samlet, og afgrænsede genkørsler med én ny test giver 644 forskellige beståede tests. APK og PDF findes i dev/artifacts med TEST40 i filnavnet. Samme testlogin/server/certifikat. Installér oven på Touchline TEST uden afinstallation. Fysiske Android-målinger mangler. Måledata og begrænsninger: test-evidence/recovery-TEST40-*.

## TEST39 — aktuel testudgave

639 tests består i én samlet kørsel. Rettet timeout ved ufuldstændig HTTP-body. APK: dev/artifacts/Touchline37-Motor11-TEST39.apk. PDF: dev/artifacts/Touchline37-Opdateringsrapport-TEST39.pdf. Installér oven på Touchline TEST uden afinstallation, brug samme login og Auto. Samme testserver og certifikat. Fysisk telefonafprøvning mangler. Se test-evidence/code-review-TEST39.md for gennemgangens præcise omfang.

## Aktuel status: TEST38 er online

Testserverrevision 2 er nu udgivet og to fulde hostede kampe er verificeret. Den tidligere blokering nedenfor er løst. Se TEST38-ONLINE.md og den nye TEST38-online-PDF. APK-filen er uændret. Fysiske Android-målinger mangler stadig.

## TEST38 — 20. november 2026

Ny signeret APK og PDF ligger i dev/artifacts. 633 forskellige tests består efter afgrænsede genkørsler; detaljer i test-evidence/performance-v38-tests.json. Opstart-JS er 981.350 bytes mod 4.571.948.

**IKKE KLAR TIL LOGIN:** Serverens revision 2-udgivelse afventer brugerens godkendelse efter automatisk afvisning. APK kræver revision 2-handshake og afviser den gamle server. Hostet R2-gemning, fysisk installation og FPS er ikke verificeret. Ingen ændring af produktion eller APK 37. Tidligere aflevering nedenfor er historisk.

# Touchline 37 — motor 11 Android-test

Status 15. november 2026: separat APK bygget og serverforløb verificeret. Dette er
en testudgave, ikke en opdatering af APK 37 eller en offentlig produktionsrelease.

## Hvad der er lavet

- Fortsat fra Claudes `claude/m5-del2` (`492af99`) via reviewcommit `a600b2a`.
- Testappen har eget app-id, egen signeringsnøgle og den præcise separate testserver.
- Nativebroen kontrollerer serveridentitet/isolering, før login eller handlinger sendes.
- Testserveren vælger motor 11 for både klub- og spillerkarrierekampe uden browsercookie.
- Egen ny database, testpepper og kun tre fiktive `.invalid`-konti; ingen R2 eller mail.
- Ingen ændringer af gameplay, motor 1–10, APK 37, det låste appdesign eller produktionen.

## Verificeret

Den bevarede testkæde samt de nye kontroller giver **588 beståede tests**. De første
587 blev gennemført i hovedkæden og dens afgrænsede genkørsler; efter lukningen af
setupflowet bestod alle otte bootstraptests, inklusive den ene nye regressionstest.
Ældre tests blev bevaret. Kildescanneren er tilpasset den ene fastlåste testorigin
og testprojektets ID; andre produktionsmarkører og konfigurationer afvises fortsat.

Android-APK-signatur og ZIP/CRC er kontrolleret. Den pakkede HTML matcher den
genererede testoverlay, og baselinewebfilen er uændret af overlayværktøjet.
Testappens delings- og supportlinks bliver i testmiljøet.

På den private, hostede server er **to komplette 250-sekunders kampforløb** kørt
med rigtig serverfrist, uden ændring af ur eller database for at fremskynde dem:

| Forløb | Motor | Resultat | Gemning | Gentagen gemning |
|---|---|---|---|---|
| Klub | 11 | 0–0 | Består | Kun ét resultat |
| Spillerkarriere | 11 | 1–2 | Består | Kun ét resultat |

For tidlig gemning blev afvist. Efter genudgivelse med lukket setup virker login,
versionsoversigt og gemt karrierehistorik fortsat. Klargøringsruten svarer 404,
og mail er deaktiveret. Beviser ligger i `test-evidence/`.

Der er endnu ikke målt FPS, varme, touch eller installation på en fysisk Android.
Den tidligere dokumenterede taklingskontaktfejl i motor 11 er ikke ændret her.

## Den separate APK

Fil: `dev/artifacts/Touchline37-Motor11-TEST.apk`.

| Egenskab | Værdi |
|---|---|
| App-id | `dk.touchline.footballidle.test` |
| Navn på telefonen | Touchline TEST |
| Version | `1.0.0-test`, kode 37 |
| Størrelse | 5.250.877 bytes |
| SHA-256 | `8c2a1c416f8f1bf9918798fee730a1f96414726b344d8cadace487c08a9b4689` |
| Testcertifikat SHA-256 | `bf6991c47983d125ef70a285da1a3cd9c7128f11b1e831a64b21af565abb0069` |

APK 37 er fortsat byte-identisk med hash
`b3da8abedb4c96072d0b876ebf4e8bf5dc04c9f1e742c2ca886ff997b60726a0`.
Testudgaven kan ikke opdatere den app, fordi både app-id og certifikat er forskellige.
Produktionsnøglen er ikke brugt, kopieret eller uploadet. Testnøglen er kun lokal.

## Godkendt testadgang

API: https://touchline37-engine11-test.glowingconch1.chatgpt.site

Projekt-ID: `appgprj_6af9bc223af88191b6d68d7616afcc25`.
Ejeren godkendte den 15. november 2026 offentlig netværksadgang til KUN denne nye
testadresse. Sites-adgangen er ændret fra privat til offentlig, og handshake
er verificeret med HTTP 200 uden Sites-token, cookie eller platformlogin.
Den eksisterende APK behøver derfor ingen genbygning eller bypass-token.

Spillets API kræver fortsat testlogin: gæstekald til spillet giver 401, og andre
konti end de tre fiktive testkonti afvises. Login til testkontoen og indlæsning af
gemt motor 11-karriere er verificeret. Klargøringsruten giver stadig 404, og mail
er deaktiveret. Bevis: `test-evidence/public-test-access.json`.

Ingen produktionskonto eller produktionsdata kan bruges her. Det aktive domæne,
produktionsappens publikum og den private websiteforhåndsvisning er uændrede.

Testlogin udleveres særskilt til ejeren. Det genererede kodeord, testpepper,
setuptokens, serviceadgang og signeringsnøgler findes ikke i Git eller APK'en.

Åbn APK-filens side i det private GitHub-repository på
Android, log ind på GitHub og brug filens downloadknap. Åbn derefter filen fra
Downloads/Filer, og tillad installation fra den app Android spørger om.
Installer **Touchline TEST** ved siden af den eksisterende app.

## Testserverens bygning og schema

`dev/test-host/prepare-site.mjs` materialiserer kun den nye, fastlåste projektmappe.
`dev/test-host/build.mjs` afviser originalens projekt-ID og alle R2-bindings.
Kun testbuilden bruger de lokale motor 11-versionsregler. Marketingressourcer/APK
er ikke i testserverpakken, og mailmodulet erstattes af en deaktiveret variant.

Den nye tomme DB bruger et schema-only Drizzle-startskema med journal og statement-
breakpoints. Alle oprindelige SQL-filer i Game-repositoryet er uændrede. Tabeller
og kolonner er sammenlignet med originalens lokale skema. Startskemaet må ikke
omskrives efter anvendelse; senere ændringer skal være nye migrationer.

`dev/test-host/host-mode.json` har `allowSetup:false`. Lukningen håndhæves ved
kompilering, så gamle runtimeflag ikke kan genåbne initialiseringen. De midlertidige
setupvariabler er også fjernet fra Sites-konfigurationen. Ingen schemaændring
foregår i normale requesthandlers.

Genbyg kun i en udviklingskopi med JDK 21, SDK 36 og de låste afhængigheder:

JVM-brotestene bruger også en eksisterende `org.json`-JAR fra Gradlecache eller
stien i `TOUCHLINE_TEST_JSON_JAR`. Testhjælperen downloader ingen pakker.

```sh
npm test
npm run android:test-key
npm run android:test-apk -- -PtouchlineTestApi=https://touchline37-engine11-test.glowingconch1.chatgpt.site
```

Ingen automatisk merge eller deployment til produktion.

## Separat websitearbejde

Den kortere hjemmeside ligger i Website-repositoryets `codex/website-slides` på
`294b4e6914daec44d8e5b606eb01da3175c328fc` og er ikke flettet ind i `main`.

Privat forhåndsvisning: https://touchline37-website-preview.glowingconch1.chatgpt.site

Der er seks manuelle slides, én nedtælling samt foldud-installation/FAQ. Logo,
citat, mørkeblå/limefarver og de fire godkendte 4K-originaler er bevaret.
32 målrettede kontroller og bundling består. Browserinteraktion og præcis mobil-
sidehøjde er ikke målt, da det foreskrevne browserværktøj ikke er tilgængeligt.
Den hostede HTML og alle fire 4K-filer er hentet og hashverificeret.

Forhåndsvisningen er et kompileret, privat reviewartefakt uden database; den viser
planlagt åbning med lokalt ur og sender ingen konto-/kontaktændringer. Den aktive
hjemmeside er uændret og kræver separat godkendelse før udgivelse.
