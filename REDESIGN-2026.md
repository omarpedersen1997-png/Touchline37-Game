# Touchline 2026 — samlet redesign

Brugerens udtrykkelige redesignbestilling erstatter det tidligere designlås. Produktion og gemte data er stadig beskyttet. Udviklingen fortsætter fra TEST43; ingen ny app eller spilarkitektur er oprettet.

## Ny struktur

- Klubhuset er en kampcentral: klubidentitet/metrics, hovedkort med næste kamp og begge kampformer, turnerings-/karrierevalg og tre administrationsgenveje.
- Stadion/økonomi og yderligere sæson-, klubudviklings- og managerinformation er foldbare. Stadionkomponenten oprettes først ved åbning. Data, belønninger, mål og eksisterende handlinger er bevaret.
- En fast, lodret navigationsdock i kompakt bredformat erstatter den nederste navigationsrække. Store skærme beholder en tekstsidebar. Alle destinationer findes fortsat via den eksisterende navigation/Mere-menu.
- Det fælles designsystem omfatter sideoverskrifter, indholdsoverflader, faner, transfers, holdvisning, karriere, dialoger, login og kampens HUD. Mørkeblå flader, limehandlinger og få accentfarver erstatter konkurrerende kort og tunge skygger.
- Auth er en tydelig introduktion plus én formular. I lavt bredformat er kortet rulbart. Sikre skærmindryk, fokusmarkeringer, minimumsmål og reduceret bevægelse bevares.

## Design og implementering

Farver: baggrund #0e202d, overflade #142b39, lime #c1f66b. Typografi: eksisterende DM Sans og Barlow Condensed. Logoet bevares. `src/console-2026.css` indlæses sidst i både normal appbuild og den separate testoverlay. Ældre komponentstile bevares som kompatibilitetsgrundlag; det er ikke en komplet oprydning af al historisk CSS.

`ClubHub.jsx` har en ny kampstruktur og et selvstændigt, behovsindlæst facilitetspanel. Dette holder de eksisterende kampcallbacks direkte testbare. `App.jsx` grupperer ekstra klubinformation i native details-paneler. Ingen fodboldfysik, serverregler eller recordingprotokol er ændret.

Hjemmesiden videreføres på `codex/website-redesign-2026` i Website-repositoryet. Den har ny introduktion/udgivelsesconsole og en bred, særskilt præsentation med emnenavigation. Ingen automatisk rotation eller falske produkttal. Gamle skærmbilleder vises ikke som billeder af redesignet; originale 4K-filer bevares arkiveret.

## Kontrol og begrænsninger

672 apptests og 81 websitetests består efter build. To tidligere forventninger om det gamle hero-foto og et altid oprettet stadion er erstattet af forventninger til ny klubgrafik og det foldbare stadion. Alle assertions om destinationer, kampformer, data og callbacks er bevaret.

TEST44 er bygget med eget test-app-id og samme testcertifikat. APK 37 og tidligere test-APK-filer bevares. Ingen udgivelse på playtouchline.dk, database/DNS-ændring eller automatisk merge. Den eksisterende private hjemmesidepreview er opdateret.

Browserbaseret visuel QA og fysisk Android-installation, touch, viewport og FPS er endnu ikke verificeret. HTTP-/bytekontrol af leverede filer er ikke det samme som at se layoutet i en browser. Der er ingen nye verificerede 4K-optagelser af TEST44, ingen nye 3D-spillermodeller og ingen påstand om FC-lignende grafik eller lagfri drift.
