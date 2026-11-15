# Kampmotor 11 – første udviklingsdel (M5)

Motor 11 ligger i `shared/football-engine11.js`. Den er en kopi af den uændrede motor 10 (`shared/football-goals.js`), som derefter er forbedret.

| | |
|---|---|
| **Status** | Registreret i `shared/arcade.js`, men **ikke aktiveret**. |
| **Nye kampe** | Får fortsat motor 10. `resolveRequestedMatchVersion(11)` giver 10. |
| **Serveren** | Genafspiller ikke motor 11, fordi den ikke står i `SUPPORTED_MATCH_VERSIONS`. |
| **Motor 1–10** | Uændrede. Det kontrolleres af `tests/engine-freeze.test.mjs`. |
| **Aktivering** | Flyt 11 fra `EXPERIMENTAL_MATCH_VERSIONS` til `SUPPORTED_MATCH_VERSIONS` i `shared/engine-versions.js`. Det kræver ejerens godkendelse, en server-deployment og appunderstøttelse. |

Tilstandens form er den samme som i motor 10, og nye felter er kun tilføjelser. Appens visning, replays og målvisning kan derfor bruge motor 11 uden ændringer.

## Uændret fra motor 10

- **Inputprotokol:** 16-bit masker, samme kommandokoder, samme kodning (`encodeInputs`/`decodeInputs`).
- **Tider og bane:** 2 × 120 s med 10 s pause, trin på 50 ms, samme banemål og målstørrelse.
- **Brugerens styring:** joystick, sprint, finte, opladning af skud/aflevering og manuel takling. Brugerens skud uden retning sigter som i motor 10.
- **Kontaktmodellen:** fod, hænder, takling, stolper og overligger.
- **Regler:** målsekvens, genstarter og statistikfelter.

## Forskelle

| Område | Motor 10 | Motor 11 |
|---|---|---|
| **Boldfysik** | Næsten ingen luftmodstand; bolden ruller uendeligt langsomt videre; dødt hop (27 %) | Luftmodstand (`airDrag`); rullemodstand med konstant friktion, så bolden kommer helt til ro; hop med 50 % elasticitet og friktion; skruen aftager |
| **Forudsigelser** | Enkel lineær model for modtagelse og målmand | Samme fysik som bolden bruges til modtagelse, afleveringsfart og målmandens læsning af skud |
| **Afleveringsfart** | 15 + 0,43·afstand (fx 19,3 m/s på 10 m) | Beregnet, så bolden ankommer med 6,5–11,5 m/s (11,9 m/s på 10 m, 16,6 m/s på 20 m) |
| **Afleveringspræcision** | Perfekt | Deterministisk retningsfejl, der vokser med pres, lav rating, lange bolde og stikninger (typisk 0,5–2°) |
| **Skud (computer)** | Fast mod det lange hjørne | Placeres væk fra målmanden; spredningen afhænger af rating, afstand, vinkel, pres og kraft; varierende skudhøjde; skru væk fra målmanden |
| **Målmandens placering** | Følger boldens x med faktor 0,24 | Står på halveringslinjen mellem bolden og målets midte og går længere ud, når bolden er langt væk |
| **Målmandens reaktion** | Reagerer straks | Reaktionstid efter rating (40: 4 tick, 60: 3 tick, 80: 2 tick); sigter mod det punkt, hvor bolden passerer hans egen dybde; eksplosivt afsæt; dykker kun, når bolden er uden for rækkevidde stående; kroppen kan blokere |
| **Målmand én mod én** | – | Går ud og lukker vinklen mod en fri angriber og kan gå i fødderne på ham |
| **Målmandens udspark** | Altid kort | Kort, hvis afleveringsvejen er sikker, ellers langt til den mest fremskudte, frie medspiller |
| **Bevægelse** | Bremser brat ved målet | Blød opbremsning, langsommere vending i fuld fart, og træthed for alle computerspillere (begge hold restituerer i pausen) |
| **Forsvar** | Ren mandsopdækning efter trussel | Samlet blok: én forsvarskæde, kompakte linjer og sideforskydning mod bolden. Presspilleren kommer på målsiden og går derfra ind i bolden. Den anden forsvarer dækker den farligste afleveringsvej, tæt på mål skudlinjen. Zone med markering tæt på eget felt |
| **Angreb** | Faste afstande til boldholderen | Støttespillere vælger hvert 6. tick den åbneste af 9 positioner (fri plads, afleveringsvej, trængsel, fremdrift). Angribere ligger på den bageste forsvarers linje og løber i dybden |
| **Boldholderens valg** | Faste tærskler | Sammenligner skudkvalitet (xG-lignende), værdien af hver aflevering, stikning til løbende spillere og dribling i den åbneste retning. Svagere hold vælger oftere forkert |
| **Førsteberøring** | Altid kontrol | En hård eller høj bold under pres kan springe fra en svagere spiller (højst 40 %) |
| **Ydelse** | `Math.hypot` | `Math.sqrt`, der er korrekt afrundet efter IEEE-754 og hurtigere, plus optimeret kollision og nedtælling |
| **Autopilot** | – | `config.autopilot === true` lader computeren styre hjemmeholdets kontrollerede spiller. Den bruges kun til simulationer, og serveren sætter den aldrig |

## Determinisme

- Al tilfældighed kommer fra kampens seed via xorshift (`random(s)`). Motorfilen bruger ikke `Math.random`, ur eller `crypto`; det kontrolleres af en test.
- Fysikken bruger `Math.sqrt`, som giver samme resultat i alle JavaScript-motorer. `Math.hypot` bruges kun i inputhjælperen `directionMask`, som er den samme som i motor 10.
- `tests/engine11.test.mjs` kontrollerer:
  - at samme seed og samme input giver en identisk tilstand (SHA-256 af hele tilstanden),
  - at serverens vej (kodning og dekodning af optagelsen) giver samme kamp som klientens,
  - at genafspilningen er identisk med den spillede kamp,
  - at forskellige seeds giver forskellige kampe.

## Balance (målt 15. november 2026)

### Computer mod computer (autopilot), 40 kampe pr. styrkeforhold

| Styrke hjemme/ude | Mål hjemme–ude | Sejre hjemme–ude | Skud/kamp | Afleveringer lykkes |
|---|---|---|---|---|
| 60/60 | 0,60–0,60 | 11–12 | 15,3 | 76,2 % |
| 75/50 | 1,20–0,45 | 21–6 | 13,9 | 76,5 % |
| 50/75 | 0,30–1,13 | 4–23 | 14,7 | 76,8 % |

Lige hold er lige, og styrke slår igennem symmetrisk.

### Testspiller mod computer, 60/60, 30 kampe

Testspilleren er en aggressiv bot i `tests/support/match-bot.mjs`. Den presser altid, sprinter og skyder inden for 21 m.

| | Motor 10 | Motor 11 |
|---|---|---|
| Mål pr. kamp (hjemme–ude) | 0,80–0,77 | 1,90–0,17 |
| Skud pr. kamp | 7,1 | 17,7 |
| Scoringsprocent | 22,1 % | 11,7 % |
| Redningsprocent | 66,7 % | 70,4 % |
| Afleveringer pr. kamp | 205 | 157 |
| Afleveringer lykkes (hjemme/ude) | 83,4 % / 65,8 % | 81,0 % / 78,5 % |
| Hjemmesejre | 33 % | 77 % |

### Andre målinger

- **Forsvarets form** (udeholdet uden bold, kamp styret af testspilleren):
  - afstand fra bageste til forreste spiller: 28 m (motor 10: 30–33 m),
  - forsvarskædens standardafvigelse: 0,8 m (motor 10: 1,2–1,5 m).
- **Målmand:** I et net af 72 skud indkasserer rating 90 færre mål end rating 60, som indkasserer færre end eller samme antal som rating 35. Testen kontrollerer rækkefølgen.
- **Ydelse:** ca. 415–560 ms pr. kamp på 4 kerner (motor 10: ca. 270–330 ms). Det er cirka 1,5 gange så langt, men godt inden for testens grænse på 2,5 s.

## Kendte begrænsninger

1. **Sværhedsgrad mod mennesker.** Testspilleren vinder 77 % i motor 11 mod 33 % i motor 10. Hovedårsagen er, at motor 10's målmand redder næsten alt fra testspilleren, mens motor 11's målmand er realistisk (ca. 70 %). En aggressiv menneskelig spiller vil formentlig opleve motor 11 som lettere. Sværhedsgraden skal kalibreres mod rigtige spillere, før motor 11 aktiveres. Parametrene står samlet i `ENGINE`.
2. **Taklinger.** Taklingssystemet er uændret fra motor 10. Bolden er beskyttet de første 7 tick efter en modtagelse, så computeren erobrer sjældent bolden med en takling (0,3 pr. kamp med testspilleren). Planlagt til næste del: taklinger og boldkontrol.
3. **Ikke spilbar i appen endnu.** Motor 11 kan ikke vælges i appen eller i testmiljøet, kun køres i tests og simulationer. Det kræver, at serveren accepterer version 11, og at appens visning er afprøvet med den.
4. **Regler.** Offside, frispark, kort, udskiftninger og kamplyd findes ikke endnu (planlagt i M5).
5. **Ydelse.** Motor 11 er ca. 1,5 gange så tung som motor 10. Det er ikke målt på en Android-telefon.
6. **Størrelse.** Motor 11 indgår i appens og serverens bygning (ca. +10 KB komprimeret hver). Referencen for serverpakkens størrelse (`tests/bundle-baseline.json`) er derfor opdateret bevidst.

---

# M5 del 2 – spilbar i testmiljøet, taklinger, boldkontrol og kalibrering

## Spil motor 11 i det lokale testmiljø

Motor 11 kan nu vælges i det lokale testmiljø **uden at ændre produktionskoden**:

| Del | Fil | Rolle |
|---|---|---|
| Lokale versionsregler | `dev/engine-versions-local.js` | Kopi af reglerne, hvor motor 11 er tilladt |
| Lokal Worker-bygning | `dev/build-local-worker.mjs` | Bygger testserverens Worker til `.dev-data/build/local-worker.mjs` og udskifter `shared/engine-versions.js` med den lokale udgave (esbuild-plugin) |
| Motorvælger | `dev/local-worker-entry.js` | `/dev/motor11`, `/dev/motor10` og `/dev/status`. Med cookien `touchline-dev-engine=11` giver nye 3D-kampe motor 11. Kun starten af en kamp ændres |
| Browserkontrol | `dev/check-engine11-view.mjs` | Spiller en motor 11-kamp i appens 3D-visning og tager et skærmbillede |

**Produktionen påvirkes ikke.** `build.mjs`, `shared/engine-versions.js` og `worker/` er uændrede. Produktionsserveren giver fortsat motor 10, også hvis appen beder om 11 og har cookien. `tests/dev-engine11.test.mjs` kontrollerer:
- at adapteren ikke findes i produktionsbygningen,
- at produktionsserveren giver motor 10,
- at en hel motor 11-kamp i testmiljøet valideres af den lokale server med præcis samme resultat som klienten.

Appens eksisterende 3D-visning bruger kun "version ≥ N"-tjek, så motor 11 vises som motor 10. Designet er uændret og afprøvet i Chromium uden fejl.

## Taklinger og boldkontrol

| | Motor 10 / motor 11 del 1 | Motor 11 del 2 |
|---|---|---|
| Computerens takling | Afgøres kun af en 0,26 m fodkontakt med en bold i bevægelse (2,5 % af forsøgene ramte) | Deterministisk duel, når benet når frem (`tackleBase`): rating, boldholderens fart, målside og afstand |
| Efter vundet takling | Bolden skydes væk fra forsvareren | Bolden bremses ind mod forsvareren ("poke"), så den erobres naturligt |
| Beskyttelse efter modtagelse | 7 tick | 4 tick (`receiveProtection`) |
| Rækkevidde for computerens takling | 1,15 m | 1,3 m (`tackleReach`) |
| Skærmning | – | Under pres holdes bolden tættere og på den side, der vender væk fra modstanderen (afhænger af rating) |
| Sprint for computerspillere | Aldrig | Med energi: pres, jagt på løs bold, modtagelse, dybdeløb og dribling i åbent rum (`aiSprint` 1,22) |
| Blokering af skud | Kroppens radius 0,43 m | Forsvarere inden for 5 m af skytten blokerer med 0,62 m (ben og krop) |
| Målmandens reaktion | (del 1: 3 tick ved rating 60) | 2 tick ved rating 60 (`keeperReaction` 4,5 − rating·0,04) |
| Dribler i feltet | Målmanden lod angriberen drible bolden i mål | Målmanden stiller sig mellem bold og mål og kaster sig i fødderne (`keeperSmother`, `keeperReach`); griber bolden ved succes |

## Svaghed fundet i motor 10 (ikke rettet, motoren er frosset)

En spiller, der **aldrig skyder**, men kun dribler, scorer 2,9 mål pr. kamp i motor 10, fordi målmanden ikke går i fødderne på en dribler. I motor 11 er det rettet til 1,0 mål pr. kamp (testet i `tests/engine11-defending.test.mjs`).

## Kalibrering (15. november 2026)

### Testspiller mod computer, 2 × 24 kampe pr. styrkeforhold (seeds "big-A" og "big-B")

| Motor | Styrke | Mål H–U | Sejre H/U/B | Skud | Konv. | Redn. | Afl. (lykkes H/U) | Takl. |
|---|---|---|---|---|---|---|---|---|
| 10 | 60/60 | 0,85–0,65 | 40/31/29 % | 6,8 | 22,1 % | 63 % | 205 (82/66 %) | 2,3 |
| 11 | 60/60 | 1,65–0,25 | 81/19/0 % | 18,2 | 10,4 % | 70 % | 159 (77/77 %) | 4,3 |
| 10 | 75/50 | 0,85–0,21 | 48/38/15 % | 7,2 | 14,9 % | 68 % | 209 (84/66 %) | 2,6 |
| 11 | 75/50 | 2,38–0,08 | 94/6/0 % | 18,5 | 13,3 % | 69 % | 157 (79/77 %) | 6,9 |
| 10 | 50/75 | 0,46–1,04 | 0/56/44 % | 4,7 | 32,2 % | 53 % | 206 (80/64 %) | 2,2 |
| 11 | 50/75 | 1,25–0,14 | 69/27/4 % | 15,3 | 9,1 % | 72 % | 167 (77/78 %) | 3,4 |

### Computer mod computer, motor 11, 48 kampe pr. styrkeforhold

| Styrke | Mål H–U | Sejre H/U/B | Skud | Redn. | Afl. (lykkes) | Takl. |
|---|---|---|---|---|---|---|
| 60/60 | 0,75–0,83 | 25/40/35 % | 15,6 | 78 % | 145 (74,6 %) | 4,5 |
| 75/50 | 0,81–0,44 | 35/48/17 % | 14,4 | 80 % | 145 (75,0 %) | 5,6 |
| 50/75 | 0,65–0,96 | 17/42/42 % | 15,4 | 75 % | 143 (74,6 %) | 6,5 |

### Konklusion

- **Hold mod hold er fair og afhænger af styrke.** Begge hold bruger samme AI, og resultaterne er symmetriske.
- **Testspilleren vinder stadig de fleste kampe i motor 11** (60/60: 81 %).
- **Årsagen er analyseret:**
  - Testspilleren presser altid bolden i fuld sprint og skyder ved enhver chance inden for 21 m (ca. 12 skud pr. kamp).
  - Computerholdets angreb går i stå mod det konstante pres: 144 af 169 boldtab går til hjemmeholdets computerspillere efter forhastede afleveringer.
  - Scoringsprocenten er realistisk (ca. 10 %) og lavere end i motor 10. Forskellen er altså mængden af chancer.
  - Motor 10's tilsyneladende balance kom især fra, at målmanden dér lod computerens få skud gå ind (32 % ved 50/75) og ikke stoppede driblinger i mål.
- **Botten er ikke et menneske.** Den endelige kalibrering bør derfor ske med rigtige spillere i testmiljøet, som nu er muligt. De relevante knapper står samlet i `ENGINE`.
