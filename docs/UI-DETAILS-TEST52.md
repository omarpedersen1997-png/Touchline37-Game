# TEST52 – tre afgrænsede UI-detaljer

Udgangspunkt: TEST51 / `c0b4204208096c5df086af36eec7b253a1d178c7`.
Kun appvisning, regressionstest og testversionsnummer ændres. Ingen motor-, spilregel-, konto-, server- eller websiteændring.

## Fund og rettelser

1. **Rund boble ved Privatliv:** Der findes ingen flydende handlingsknap ved footeren i TEST51-koden. Lokal Chromium-kontrol ved 320×640, 390×844 og 915×412 viste heller ingen sådan knap. Den konkrete telefonobservation er derfor ikke reproduceret eller identificeret. `contain:paint` begrænser nu karriere-/Europa-/pokal-kortenes dekorative ikoner til deres egne kort. Footeren får sin egen isolerede malekontekst. Funktionelle knapper og tastaturgenvejen til indhold bevares. Dette må ikke beskrives som en sikkert identificeret/fjernet floating action-knap.
2. **Din samlede fordel:** TEST51 havde én forekomst i kildekoden og én i den kontrollerede DOM. Ingen reproduceret duplikering. Heading, forklaring og de fire faktiske bonusser er nu samlet i én navngivet `exp-total-benefits`-sektion uden for de tre DNA-retninger; den generiske `compact`-klasse udgår her. En regressionstest kontrollerer ingen/alle tre valgte retninger samt de øvrige faner. Gentagne faneskift må aldrig oprette ekstra sektioner.
3. **Klubtal:** De små layouts skjulte labels og brugte kun 8–14 px afstand. Holdstyrke, fans og ligaplads vises nu som tre separate gridkolonner med 14–24 px gap, en fin skillelinje og 12 px indvendig afstand mellem kolonner. Tal bruger tabular-nums og brydes ikke. I portræt ses labels igen; hele talgruppen kan gå rent på næste linje ved 320 px i stedet for at klemme klubnavnet.

## Ændrede kildefiler

- `src/stadium-console.css`: dekorationsafgrænsning, footerens malekontekst, statistikgrid, skillelinjer og portrætlabels.
- `src/ExpansionCenter.jsx`: én eksplicit samlet bonussektion med tilgængelig navngivning; eksisterende tekst, bonusdata og handlers bevares.
- `tests/expansion-ui.test.jsx`: kontrol af præcis én fælles bonussektion i alle DNA-valg og nul i de øvrige faner.
- `dev/test-release.json`: separat TEST52-version; samme test-app-id og certifikat.

Afleveringen tilføjer APK/PDF, denne dokumentation, TEST-ANDROID.md og evidens under `test-evidence/ui-TEST52-*`.

## Kontrol og praktisk telefonprøve

Browserkontrollen bruger fiktive, lokalt afskårne data og kontrollerer Spil + KlubDNA ved 320×640, 360×740, 384×724, 390×844, 600×900, 740×360, 915×412 og 1440×900. Den måler afstand mellem tallene, kontrollerer Privatliv med hit-test, søger efter flydende bundknapper og skifter DNA/forskning tre gange pr. størrelse. Testresultater og skærmbilleder følger afleveringen.

På telefonen: Opdater Touchline TEST uden afinstallation. Åbn Spil i portræt og bredformat; kontrollér tal/labels, hele klubnavnet og Privatliv. Åbn Klubcenter → Klubbens DNA, rul til bunden, skift til Forskning og tilbage: Din samlede fordel skal stå én gang med fire bonusser. Den oprindeligt beskrevne boble/gentagelse kræver fortsat fysisk bekræftelse, da de ikke kunne reproduceres i browseren.

Motor 11 revision 3, motor 1–10/R1/R2, optagelser, APK 37 og alle tidligere artefakter bevares. playtouchline.dk og testserveren genudgives ikke. Ingen merge til main. Fysisk Android-installation og telefonens gengivelse er ikke verificeret i dette miljø.
