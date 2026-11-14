# Start her — Touchline til Claude

Dette er et selvstændigt kildekodeudtræk fra commit c71fbb7b617e95f23c737dc5a9fc7fc0a206430e. APK 37, appversion 1.0.0, kampmotor 10. Kildekodefilerne er kontrolleret mod Git-objekterne; deres SHA256 og Git-blob-id står i HANDOFF-MANIFEST.json.

## Adgang og afgrænsning

Mappen /workspace/sites/touchline ligger i Codex-miljøet og er ikke en mappe på brugerens telefon eller i Claude. Udpak denne ZIP og arbejd i den udpakkede touchline-mappe. Git-historik og .git er udeladt; baselinecommit står i SOURCE-COMMIT.txt. Du behøver ikke GitHub-adgang for at arbejde med filerne.

Kun kampdelen må ændres. Appens og hjemmesidens øvrige design, farver, logo, navigation og kluboversigt er godkendt og låst. Hele appen skal fortsat bruge bredformat. Ingen Google Play-udgivelse. Offentlig web/APK-lancering er 1. januar 2027 kl. 10 dansk tid; bevar launchgate og eksisterende adgangskontrol.

## Nuværende kode

- src/: React19-interface og Three.js-rendering.
- shared/: deterministiske kampmotorer til klient og server.
- worker/: Cloudflare Worker, API, login og spiltilstand. D1 til database og R2 til artefakter.
- android/: Capacitor8-wrapper og Android-integration.
- tests/, scripts/, assets/, drizzle/, release/: tests, bygning, aktiver, migreringer og releasefiler.

Start med README.md, package.json, release/MATCH37-REVIEW.md, shared/arcade.js, shared/football-goals.js, worker/manual.js, src/ManualMatch.jsx, src/manual-scene.js og src/pro-player.js.

Klubøkonomi, transfers, akademi, forskning, liga/oprykning, sæsonpokal, Aurora Europa Cup og spillerkarriere findes allerede. Manuel kamp har11 mod 11, to 120-sekunders halvlege og10 sekunders pause, afleveringer/stikninger/skud/tacklinger/sprint/finter, taktiske skift, målfejring, netkontakt, replays og sikker servervalideret resultatgemning.

## Næste arbejde

Prioritér mere naturlige fodboldanimationer og boldkontrol, individuelle spilleregenskaber, bedre forsvarsstyring/AI og målbar Android-ydelse. Løbeanimationer og grounding findes allerede; skud/tacklinger/målmandsdyk er enklere procedureanimationer. Almindelige klubspillere bruger i høj grad samlet holdrating. Offside, frispark/kort, liveudskiftninger og fuld kamplyd mangler; simple indkast/hjørnespark/målspark findes.

Ændr ikke kampmotorerne 1–10 ved nye deterministiske regler: opret motor 11, og opdatér dispatcher, klient, serverens versionslister og tests. Igangværende kampe skal fortsat kunne afspilles og gemmes med deres oprindelige motor. Klient og server skal gengive samme inputoptagelse identisk. Bevar resultatrecovery og idempotente belønninger.

## Bygning og tests

Fra projektroden med Node og afhængigheder til rådighed. Node24 er brugt til baselinekontrollen; testpakken kræver node:sqlite:

```sh
npm ci
npm test
npm run android:sync
npm run release:check
```

Hvis netværk/pakkeinstallation er lukket i dit miljø, kan du stadig læse og ændre koden og returnere den. Beskriv præcist hvilke checks du ikke kunne køre. Påstå ikke, at tests, APK eller4K-optagelser er verificeret uden faktisk at køre dem.

Seneste fulde testkørsel i Codex bestod486 tests. Begge 250-sekunders liveforløb (klub/spillerkarriere) blev gemt med kanonisk resultat og belønning kun én gang. Det er historisk baselinevalidering, ikke en test af dine nye ændringer. Fysisk Android-FPS, varme og touchforsinkelse er endnu ikke verificeret.

Den vedlagte release/downloads/Touchline-1.0.0.apk er den eksisterende signerede version37 og et baselineartefakt, ikke en ny build af dine ændringer. Dens hash kontrolleres af buildscriptet. Aktuelle originale 4K-webvisninger og deres manifest er medtaget. Ved ny APK skal billederne genoptages via scripts/capture-app-web-4k.py; aldrig opskalér ældre billeder. Læs release/CAPTURE-WORKFLOW.md.

## Signering og aflevering

Signeringsnøgler, adgangskoder, private tokens, node_modules, AndroidSDK/Gradlecache, kontodata og produktionsdatabase medfølger ikke. Du skal ikke bede brugeren uploade en keystore. En ny lokal debugnøgle kan ikke opdatere den eksisterende installation. Den eksisterende APK-certifikat-SHA256 er 968e6554f40e6cdc7e134c731c3ec42402c3fb9181f3e015b614da7d81d0204b.

Arbejd lokalt og returnér den ændrede kildekode som ZIP eller en tydelig patch samt en kort ændrings-/testrapport. Brugeren kan sende den retur til Codex, hvor den eksisterende Androidbygning og signering kan bruges. Publicér ikke en ny hjemmeside eller APK fra dette kildekodeudtræk. Bevar licenser og eksisterende projektidentitet.

Ældre APK-/Playpakker og gamle screenshots er udeladt for at reducere ZIP-størrelsen. En eksisterende ikke-versioneret brugerfil, release/ONE-CLUB-ONE-DREAM-REVIEW.md, er ikke medtaget.
