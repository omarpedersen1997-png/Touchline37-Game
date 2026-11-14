# Sikkerhedskopi af hele Touchline 37

Dette er en separat kopi af den eksisterende hjemmeside og Android-spillet. Begge originale produkter deles om kildeprojektet; derfor indeholder begge private repositories alle 398 versionerede baselinefiler med oprindelige relative stier, alle 902 udvalgte eksterne authoring-/generatorfiler, lokale ufærdige filer i et særskilt område og dokumentation. Ingen originalfunktioner er omskrevet.

Læs CLAUDE.md før arbejde. Den oprindelige README.md og alle oprindelige konfigurationer er bevaret uændret. BACKUP-MANIFEST.json angiver hver original- og tillægsfils størrelse, SHA256 og Git-blob-id.

Den komplette lokale Git-historik med 67 commits ligger som en verificeret Git-bundle i begge ZIP-filer. Historikbundlen er ikke en GitHub-kildefil, da den overstiger 100 MiB. ZIP-filer og hashes kan vedhæftes som ikke-publicerede private backupkladder i repositoryet; dette er ikke en app- eller websiteudgivelse.

## Bevarede produkter

- Hjemmeside: https://playtouchline.dk — aktiv Sites-version 55, originalt mørkeblåt/limegrønt design, sider, nedtælling, SVG-illustrationer, fonts og originale 4K-webvisninger.
- Android: Touchline Football Idle 1.0.0, versionCode 37, kampmotor 10. Original signeret APK og hele kildekoden er medtaget.
- Original Git-baseline: c71fbb7b617e95f23c737dc5a9fc7fc0a206430e.
- GitHub website: https://github.com/omarpedersen1997-png/Touchline37-Website
- GitHub spil: https://github.com/omarpedersen1997-png/Touchline37-Game

## Gendannelsesgrænser

Produktionsdatabasens faktiske bruger-/klub-/loginrækker, fuld R2-bucket, ejerens runtimehemmeligheder, private signeringsnøgle og mobilens lokale data er ikke eksporteret til kildekodebackups. Databaseskema/migreringer og nødvendige binding-/variabelnavne er med. Der er ikke foretaget nogen produktionsskrivning, DNS-ændring eller deployment. Den fulde DNS-zone og registraradgang er ikke verificeret.

Autoritative driftsdata skal eksporteres særskilt via ejerens Sites/Cloudflare-backupadgang og opbevares sikkert uden for GitHub. Kopiér ikke adgangskoder, sessionsdata eller signeringsnøgler ind i disse repositories.

Node-moduler, SDK/JDK-installationer, caches og tredjepartsdemovideoer er ikke selve projektkoden og medfølger ikke; versions-/lockfiler og licenser bevares. De fundne Blenderoriginaler og generatorens lokale kildeændringer er medtaget. Se backup-records/reports/game/EXTERNAL-ASSETS.md.

## Android og Claude Code

Åbn GitHub-linket i Chrome og log ind på ejerkontoen. Åbn CLAUDE.md for vejledningen. I en Claude Code-websession med GitHub-adgang vælges en af disse isolerede repositories; i en terminal bruges git clone af repositoryets HTTPS-adresse. Claude Code kører ikke som en indbygget Android-app gennem denne backup. ZIP-filer kan downloades fra backupkladden, hvis GitHub tillader de vedhæftede filer.

Prompt til Claude:

> Læs CLAUDE.md og BACKUP-MANIFEST.json. Dette er en bevaringskopi af Touchline 37. Bekræft først arkitektur, filintegritet og begrænsninger. Arbejd kun på en ny udviklingsbranch i denne kopi. Ændr ikke design, gameplay eller funktioner, og udfør ingen deployment eller produktionsændringer uden min udtrykkelige godkendelse. Beskriv en plan, før du ændrer kode.

## ZIP-filer og historiske binære artefakter

For at undgå store dubletter indeholder ZIP-filerne den aktuelle byggelige kildekode, aktiver, dokumentation og hele Git-bundlen. Ældre APK-/Play-pakker under release/downloads findes i Git-bundlen i deres oprindelige versioner, mens den aktuelle APK37 og current.json også findes direkte på deres oprindelige stier. GitHub-kildetræerne indeholder alle baselinefiler direkte. ZIP-INVENTORY.json angiver præcist, hvilke filer der er direkte i ZIP, og hvilke der bevares i historikbundlen. Intet historisk kildearbejde er udeladt.

Git-bundlen kan genskabe det komplette oprindelige repository i en NY mappe: git clone backup-records/history/Touchline37-original-history.bundle gendannet-touchline37. Kør aldrig dette oven i originalmappen.
