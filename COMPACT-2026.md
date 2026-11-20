# TEST45 — sider frem for en lang indholdsliste

Denne udgave fortsætter TEST44. Brugeren bestilte et nyt redesign med mindre lodret rulning og efterfølgende yderligere optimering af kampvisningen.

Appens klubhus er opdelt i Kamp, Spilunivers, Stadion, Fans og Rejse. Holdet har Opstilling, Taktik og Trup & reserver. Faciliteter, liga, mål og spillerkarriere er tilsvarende opdelt i opgaver. I bredformat fra 340 CSS-pixels højde følger appens ramme viewporten; kun indholdet i den aktuelle opgave kan rulle. Navigation, hovedoverskrift og faner bevares. Små højder og zoom får almindeligt dokumentflow, så kontroller ikke klippes. Længere tabeller og formularer er stadig rulbare; der påstås ikke nul rulning på alle enheder.

WorkspaceDeck bevarer formularpaneler monteret ved faneskift. Stadionpaneler er eksplicit udsat, indtil de åbnes. Karrierens genveje afslører den relevante fane før fokus/rulning. Tastaturpile/Home/End understøttes med roving tabindex og sammenhængende ARIA-tab/panel-id'er. Opstillingens Trup-knap åbner den nye trupfane.

Hjemmesidens separate udviklingskopi får Overblik, Spillet og Kom i gang & hjælp som særskilte sider. De eksisterende seks slides og direkte ankre bevares. Kun ejerens private preview opdateres, ikke playtouchline.dk.

## Kampoptimering

- `match-viewport.js` flytter gentagne clientHeight-målinger fra tegneløkken til ResizeObserver-forløbet. Uændret boldsynlighed/resolution og kamerafysik.
- `football-swing.js` genbruger lokale akser og quaternion-objekter til fodboldhandlinger i stedet for at oprette dem ved hvert spark. Test mod den tidligere beregning og eksisterende tests af faktiske fodsåler bevares.
- `replay-playback.js` bygger kun et replaybillede, hvis det faktisk skal tegnes. På en 120 Hz callbacksekvens med 60 FPS-tegning falder antallet af samples fra 121 til 61 pr. sekund inklusive start/slut. Ved 30 FPS falder det til 31. Slutbilledet vises præcist én gang.
- `match-joystick.js` genbruger joystickets mål under en fastholdt bevægelse og nulstiller ved slip, afbrydelse og resize. Retning, rækkevidde og touchinput er bevaret i test.

`dev/benchmark-match-hotpath.mjs` registrerer CPU-mikromålinger og operationstal i test-evidence/compact-TEST45-hotpath.json. Disse er ikke GPU-tider, Android-FPS eller bevis for lagfri drift. Grafikniveau, modeller, opløsning, inputprotokol og kampmotorregler er ikke reduceret eller ændret.

## Beskyttelse og begrænsninger

APK 37, alle tidligere test-APK'er, motor 1–10, original motor 11, gemte optagelser og serverversion 6 bevares. Ingen produktionsændring, DNS/databaseændring eller merge til main. TEST45 bruger samme separate test-app-id og testcertifikat.

Ingen fysisk Android-installation, touch-, temperatur- eller FPS-måling er gennemført i dette miljø. Browserbaseret visuel kontrol er ikke tilgængelig. Kilde-/HTTP-/testkontrol dokumenterer ikke layoutets faktiske visuelle kvalitet. Ingen nye verificerede 4K-screenshots.
