# Billeder fra den aktuelle app

Hjemmesiden må kun vise originale optagelser af den aktuelle, signerede APK i mindst 3840 × 2160 pixels. Opdateringer kræver nye optagelser. Gamle filer må ikke forstørres eller præsenteres som en nyere version.

Den automatiske weboptagelse køres med `python3 scripts/capture-app-web-4k.py`. Den indlæser den præcise HTML fra den signerede APK, bruger spillets rigtige API og en isoleret SQLite-database og optager brugerfladen og kampmotoren direkte i Chromium. Weboptagelser skal mærkes tydeligt som webvisning. De er ikke optagelser fra en fysisk Android-enhed. Direkte JPEG-optagelser i kvalitet 98 beholder de native 3840 × 2160 pixels; et mindre billede må aldrig forstørres.

Android-optagelser kan alternativt laves sådan:

1. Byg og signér APK'en. Opdatér `release/downloads/current.json` med dens versionsnummer og SHA-256.
2. Installér præcis denne APK på Android-enheden/emulatoren. Vis appen i bredformat med en native framebuffer på 3840 × 2160. Brug en midlertidig QA-konto, og undgå personlige oplysninger.
3. Åbn hver relevant visning gennem appens normale brugerflade. Optag eksempelvis klubhus, hold, klubcenter og en aktuel 3D-kamp.
4. Kør `python3 scripts/capture-android-4k.py --id klubhus --title 'Dit klubhus' --description 'Klubbens næste skridt.' --alt 'Touchlines klubhus i bredformat.'` for den aktuelle visning. Gentag med et unikt id for de øvrige visninger. Scriptet kontrollerer den installerede APK og gemmer Androids originale PNG uden billedbehandling.
5. Gennemse optagelserne visuelt, og fjern eventuelle fejlvisninger. Slet QA-kontoen efter kontrollen.
6. Kør `npm run release:check`. Kontrollen kræver friske 4K-optagelser med samme versionsnummer og kontrolsum som APK'en. Hjemmesiden skjuler automatisk forældede billeder, også før kontrollen køres.

Optagelsernes kontrolsummer, APK-hash og HTML-hash registreres i `release/site-captures.json`. Hjemmesiden og APK'en udgives først, når de nødvendige app-, server- og billedkontroller er færdige. Billeder fra en softwareemulator dokumenterer udseende; de må ikke bruges som måling af FPS på en fysisk telefon.
