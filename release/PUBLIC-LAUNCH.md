# Første offentlige lancering — Touchline 1.0

Aftalt med ejeren: fredag 1. januar 2027 kl.10.00 Europe/Copenhagen. Det er 2027-01-01T09:00:00.000Z. Google Play er ikke en del af denne åbning.

- Hjemmesiden viser en nedtælling og status for Android/web.
- `/api/launch` bruger serverens ur og returnerer opensAt, serverTime og open. Klientens ur korrigeres mod serveren; links aktiveres kun efter open=true.
- `/play` og `/downloads/Touchline-1.0.0.apk` åbner ved grænsen. Stabil APK-adresse: `/downloads/touchline.apk`.
- Før grænsen returnerer begge ruter404. Ingen query/header kan åbne dem tidligt. No-store for metadata, spil, APK og afviste downloadruter forhindrer stale404 omkring åbning.
- Gamle test-APK-adresser, andre versioner og alle ZIP-adresser forbliver404, også efter åbning.
- Åbningen kræver intet job eller en aktiv chat: Worker evaluerer klokkeslættet på hver forespørgsel.

## Byg og godkend kandidat

Den første offentlige version hedder1.0.0 med versionCode14. Tidligere2.x var private builds. Code14 er højere end de tidligere private installationer; eksisterende certifikat bevares.

`npm run android:sync` efterfulgt af `:app:assembleSideload :app:bundleRelease` med den eksisterende Android SDK/JDK21 opsætning. Sideload er en release-konfiguration med debuggable=false og den eksisterende APK-signatur. Keystore må aldrig roteres eller genereres på ny ved et uheld. Gradle afviser sideloadbygning, hvis den eksisterende store mangler.

Den godkendte certifikat-SHA256 er968e6554f40e6cdc7e134c731c3ec42402c3fb9181f3e015b614da7d81d0204b. Private nøglefiler ligger uden for repository og offentlige pakker; de skal bevares og sikkerhedskopieres privat af ejeren. Play-bundlen er fortsat usigneret og kræver senere ejerens separate Play-opsætning.

`release/downloads/current.json` peger på den godkendte APK og dens SHA256. build.mjs nægter at pakke en fil, som ikke matcher hashen. Ved en ny kandidat skal appversion, versionCode, launch.apkVersion, current.json og godkendt APK opdateres sammen.

## Kontrol

Gate-tests simulerer lige før, præcis på og efter åbning. De kontrollerer APK-bytes, GET/HEAD, metoder, auth og cache. UI-tests kontrollerer nedtælling, fejlsituation, forkert klientur, serverbekræftelse og web/native-links. Browser/Android deler backend og konti.

Interaktiv browserautomatisering er ikke tilgængelig: environment ccarenv_b64_Y2NhcmVudl84NTY1ZjY5MTExODg4MTkxOThlNjIwM2EwMWEwOTgwOA har remote_desktop enabled/unknown, men cua_repl.js udbydes ikke. Der er derfor ikke kørt interaktive browserklik eller nye browserskærmbilleder. De fremsendte telefonbilleder bekræfter den fælles UI, men en manuel browsergennemgang udestår.

Mailnulstilling er stadig deaktiveret uden mailleverandør. Login og oprettelse virker; utilgængelig nulstilling er tydeligt mærket i login/FAQ. Support gemmes som private henvendelser og videresendes endnu ikke automatisk.

Ved en kritisk fejl før lanceringen skal åbningen udsættes ved en ny deployment eller rollback til en tidligere lukket version. Nye testdownloads må ikke genåbnes som en omvej.
