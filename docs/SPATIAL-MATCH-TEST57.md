# TEST57 – figur, bold, målmand og kamera

Udgangspunkt: TEST56 `1b3b1c5eb4d26dbded3aa410527e2345999239c7`.
Udviklingsbranch: `codex/test57-spatial-match`. Ingen merge eller deployment.

## Faktiske ændringer

### Figurer, dragt og målmand

De skinnede GLB-modeller fra `public/match-assets55/` genbruges uændret.
Rich-modellernes visuelle proportioner får 14–18,5 % mere bredde og 10–13 %
mere dybde; målmænd får 20–24,5 % og 15–18 %. Højden varierer højst 1,35 %.
Variationen følger trøjenummer, så den er stabil på tværs af indlæsning/LOD.
Dette ændrer hverken kollisionskrop, rækkevidde, spillerattributter eller fart.

Rygnummer og klubmærke var selvstændige flader på figurens rod. De kunne stå
tilbage, mens brystet drejede, lænede sig eller dykkede. De bindes nu til
brystbenets resttransform én gang under oprettelsen og følger skeletbevægelsen.
Overgangen mellem høj/lav LOD kopierer også overkroppens hældning.

Det gamle dyks rodbevægelse brugte 16 ticks, mens R3-dykket varer 10. Det var
desuden en rotation omkring fødderne med konstant løft ved start. Den nye
præsentation bruger dykkets faktiske varighed og sub-tick-tid, roterer omkring
bækkenet og spejler efter spillerens lokale sideretning. Ingen simulering eller
redningssandsynlighed ændres. Den faktiske skinnede geometri testes over græsset.

En rigget målmand kan gå roligt i beredskabsstilling, når en farlig bold nærmer
sig: knæene bøjes og armene bringes frem som et additivt lag over gang/idle.
Vægten dæmpes i tid og frigives ved stop, eget boldhold, spark og dyk. Det er
en forberedende animation; målmandens beslutning/greb/parade følger stadig R3.

### Boldvægt, kontakt og skygge

Tidligere gav en mulig kontakt hvor som helst i den kommende 45 ms-periode
et visuelt stop for hele perioden. R3's 3D-visning bruger nu den tidligste
kontaktfraktion og bevæger bolden frem til lige før kontakten. Hvis bolden
allerede er inde i kontaktzonen, fastholdes den autoritative position.
En nyligt afsluttet kontakt kan kun frigive den gamle 150 ms-beskyttelse,
når kontaktens tick, hold og spiller stemmer med motorens sidste berøring.
Den kommende kropskontakt kontrolleres fortsat. R1/R2 og andre kald beholder
den gamle konservative standardsti.

Fremtidspunktet til kontaktkontrollen bruger R3's eksisterende rulle-/luftmodstand,
tyngdekraft, curl og opspring. Flade pasninger, stikninger, indlæg, skud og løse
bolde får ikke kunstige fartmultiplikatorer: deres eksisterende forskelle vises
med færre unødige stop. Førsteberøringen beregnes stadig af den uændrede motor.

Én konvertering fra fysisk boldcentrum til vist boldradius placerer boldens
bund på banens højde. Samme viste højde bruges af kameraet. Boldens rul følger
nu dens viste omkreds, mens fastholdte replayframes ikke ophober rotation.
Skyggen forskydes med luftboldens højde, breder sig og bliver svagere. Den står
ikke lige så mørk og skarp under en høj bold som under en bold på græsset.

### Kamera og lys

Kameraet kan løfte sit sigtepunkt roligt ved høje bolde, begrænset til 3,2 m
over det normale sigtepunkt. Den eksisterende dæmpning, faste styringsakser,
højst 8 % dynamisk afstand, centrale afspark og nulstilling fra TEST56 bevares.
Reduceret bevægelse beholder det faste lodrette sigtepunkt.

Det tidligere stærke hemisfæriske fyldlys gjorde hud og stof fladere. Rich R3
har mindre fyldlys, tydeligere varm hovedbelysning og et svagt køligt modlys.
Modlyset har ingen skyggepassage. Græsstriber og normalstyrke er afbalanceret
til samme lys. De eksisterende instansierede kontaktskygger orienteres efter
figurens retning og bliver bredere ved dyk. Auto får ikke en dyr realtidsskygge
eller nye post-process-effekter; 4K bevarer sin eksisterende skyggeindstilling.

## Test og tekniske grænser

`tests/spatial-match.test.mjs` dækker den tidligste sikre kontakt, post-kontakt-
beskyttelse, uændret state, forskellige fysiske boldprofiler, opspring og
førsteberøring, radius/terræn/skygge, rul/pause, højt kamerasigte, 30/60/120 Hz-
beredskabsstilling, spejlede dyk og faktiske skinnede modeller/print/fodfæste.
Den eksisterende suite dækker fortsat fire-inputsloft, fuld identisk replaypakke,
R2/R3-checksums, gamle motorer, afspark, lyd, UI, lagring og testmiljøets isolation.

Motoren er stadig en deterministisk 20 Hz-simulation. Det visuelle lag kan tegne
ved 60/120 Hz, men kan ikke træffe en fremtidig duel-/redningsbeslutning. Ved
uafgjort tæt kontakt kan et kort konservativt stop derfor fortsat forekomme.
Meget lav renderfrekvens kan fortsat falde bagud med det uændrede loft på fire
inputs pr. billedkald. En 120 Hz-skærm er ikke dokumentation for 120 render-FPS.

Modellerne har eksisterende capture-klip suppleret med forfattede fodboldposer.
Denne opdatering tilføjer ikke motion matching, fuld muskel-/stofsimulation,
fysisk fod-til-bold-kollision eller nye AI-/fodboldregler. Anatomiske ændringer
er visuelle og giver ikke en større fysisk spillerkrop i simulationen.
Et grundlæggende løft af disse systemer kræver en ny eksplicit motorrevision,
backendvalidering og test af nye optagelser parallelt med de gamle.

Fysisk OnePlus Nord 4 er ikke tilgængelig her. Installation, fysisk touchlatens,
60–120 FPS, RAM, varme, batteri og oplevet boldvægt skal prøves på telefonen.
Chromium/software-WebGL bruges til fejl-/asset-/flowkontrol og er ikke et
telefonbenchmark. Ingen påstand om EA Sports FC-kvalitet eller lagfrihed.

## Bevarede grænser

Ingen ændring af `shared/`, `worker/`, native Android-kode eller eksisterende
binære assets. Frosne kontrolsummer:

- R2: `4ad518a8d5fe454a76cbca4345f0f2294a1b6e7fddb3f98c9d17dad47d6d6f42`.
- R3: `274b4d45a4fae126f62e3e9d79f7c76e9bc8eca0aa6d59fcfcc1203961fe1e10`.

APK 37, tidligere APK/PDF, motor 1–10, R1/R2, optagelser, samme test-id/certifikat,
lokale valg, main, produktionsdata og offentlig hjemmeside v56 bevares.
Lancering: fredag 1. januar 2027 kl. 10.00 København / 09.00 UTC.

## Fem minutters OnePlus-prøve

1. Opdater Touchline TEST uden afinstallation. Brug Auto og 60 FPS først.
2. Se på spillernes bryst/arme/ben, trøjenumre under vending og målmanden før et
   skud. Prøv 90/180-graders vendinger, løb/sprint, spark og finte med styrepuden.
3. Prøv flad aflevering, stikning, holdt/løftet aflevering og korte/hårde skud.
   Se efter rettidig kontakt, rul, opspring og adskillelse mellem bold og skygge.
4. Følg en høj bold og en målmandsparade. Kameraet skal bevare overblik uden
   at skifte styrepudens retning. Gå i baggrunden og tilbage én gang.
5. Hent ydelsesrapport og kampbackup. Spil derefter 10–15 min. for at vurdere
   vedvarende FPS, varme og batteri; begynd med Auto frem for 4K.

## Ændrede kildefiler

- `src/football-body-profile.js` (ny), `src/pro-player.js`, `src/player-rendering.js`.
- `src/match-ball-surface.js` (ny), `src/match-prediction.js`, `src/ball-roll.js`.
- `src/match-lighting.js` (ny), `src/living-camera.js`, `src/manual-scene.js`.
- `tests/spatial-match.test.mjs` (ny), `package.json`, `dev/test-release.json`.
- Denne rapport, `TEST-ANDROID.md`, ny TEST57-APK/PDF og `test-evidence/spatial-TEST57-*`.
