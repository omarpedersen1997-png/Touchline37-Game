# TEST56 – direkte R3-styring og synkron kampvisning

Udgangspunkt: TEST55 `acac7398af2ee1657d136a781f18ae3f686e0a00`.
Branch: `codex/test56-direct-feel`. Denne runde ændrer kun kampklienten,
præsentationen, test-/buildmetadata og dokumentationen. Ingen merge/deployment.

## Fundne årsager og konkrete rettelser

### Finger, knapper og styrepude

HUD'ets 180 ms-interval blev også brugt til ladningsindikator og oplysninger om
boldholder/styret spiller. Det fik ladning og knaptekster til at virke forsinkede.
R3's knapper får nu trykfeedback direkte i pointer-eventet. Ladningsindikatoren
opdaterer kun ændrede DOM-værdier og venter ikke på React-HUD'et. Ejerskab,
kontrolleret spiller, afsluttet finte-cooldown og kampfase kan udløse en hurtig
HUD-opdatering; ur/statistik/minikort opdateres fortsat begrænset.

Ladningsvisningen overtager kortvarigt fokusbjælkens plads **under** minikortet.
Den tidligere placering kunne overlappe kortet. Ved slip/annullering kommer
fokusbjælken tilbage på samme plads, uden layoutmålinger i render-loopet.

Hver kontrol har sin egen pointer-ejer. En anden finger kan ikke overtage
styrepuden, og en forkert pointer-up nulstiller ikke en aktiv kontrol. Sprint og
joystick kan holdes samtidigt. Cancel, mistet capture, baggrund og menu rydder
trykfeedback og uforbrugte handlinger. Finte/stikning frigiver deres feedback,
når engangsinputtet faktisk er forbrugt, også hvis knappen derefter deaktiveres.

R3's styrepude bruger en mindre, hysteretisk dødzonen: aktivering ved 0,14 og
stop under 0,09 af den normaliserede radius. Det giver tidligere respons uden
flimren ved centrum. De samme 32 retninger, hastighedsbånd og roterede akser
sendes til den eksisterende motor. Legacy-styrepuden beholder sin gamle projektion.
Nyeste coalesced pointerpunkt anvendes, og bounding-rect læses én gang pr. gestus.

En taktisk kommando kunne forbruge en sampleslot og samtidig rydde en ventende
aflevering/afslutning. R3 beholder nu engangsinputtet til en faktisk sampleslot
for styringen. Der indhentes stadig højst fire inputs/2 ms pr. billedkald.
Ingen fysikticks droppes, og input flyttes ikke tilbage til tid brugt i baggrunden.

Kort tryk/slip, doseret skud og hold/slip til løftet aflevering er bevaret.
En rigtig handling udføres ved næste gyldige 50 ms-inputtick; den umiddelbare
knap-/ladningsfeedback er ikke en forudberegnet eller falsk boldhandling.
Ydelsesrapportens `input` viser DOM-input til forbrugt sampleslot, også i Enkel.
Det er ikke fysisk skærm-/touchlatens eller en måling af en udført fodboldhandling.

### Bevægelse, spark, finte og fodfæste

De nye GLB-spark var timet mod 12 ticks, mens R3 faktisk bruger 7 ticks til
aflevering og 10 til skud. Desuden styrede hele kampens `lastAction` animationen;
en anden spillers handling kunne afbryde et spark. Animationssampleren bruger nu
spillerens egen handling/varighed. Sparket begynder nær klippets kontaktposition,
følger det faktiske gennemslag og forbliver aktivt, mens andre spillere handler.
Ved ladning ses forberedelsen frem mod samme kontaktposition.

Spark, tackle-/dykkeposer og finte kan samples mellem 50 ms-ticks med en afgrænset
fraktion på højst 45 ms. Holdte replays og freeze får ingen ekstra tidsfremføring.
Kontaktovergangen er kortere; almindelige gangskift beholder en blød overgang.

Idle/gang/løb og sprint bruger hysterese, så støj omkring fartgrænsen ikke
gentagne gange genstarter clips. Løb/sprint deler gangfase i den eksisterende
retimede GLB-cyklus frem for at fade en korrekt plantet løbefod væk.
Overkropsvendingen bruger den viste kropsvinkels **vinkelhastighed**, med fortegn,
frem for en fast vinkelgrænse pr. frame. Den virker derfor også ved 120 Hz.
En finte lægger en kort ben-/overkropsbevægelse oven på den løbende pose; den
erstatter ikke benenes aktuelle rotation med hvileposen.

Interpolerede quaternions normaliseres. En test fandt en lille Float32-afvigelse,
som gav en falsk vinkel mellem ellers identiske rotationer. Grounding anvendes
fortsat efter posen. Testen med den faktiske GLB måler de reelle støvlesåler
gennem acceleration, 180-graders vending, spark og finte ved 60 og 120 Hz.

### Boldkontakt og kamera

En tidligere reception kunne holde boldens visuelle forudsigelse tilbage i tre
ticks, selv efter en ny, allerede bekræftet aflevering eller et skud. R3 genkender
nu det nye spark gennem handling, tick og faktisk sidste berøring. Bolden vises
med den eksisterende R3-fysiks sub-tick-bevægelse med det samme. Den konservative
swept-kontrol af kommende kontakt med modtager/forsvarer/målmand bevares.
R1/R2 beholder den gamle kontaktsti. Der er ikke tilføjet ny fart eller ændret
rullemodstand, skudretning, spredning, restitution eller kollisionsregler.

Kameraets kritiske dæmpning reagerer hurtigere (14 mod 9). Et begrænset
feedforward-led følger sammenhængende målbevægelse; pludselige spring og
retningsskift håndteres af fjederen. Lookahead er reduceret til 0,06 s med
boldholder og 0,10 s ved fri bold. Det mindsker unødig foran-/bagefter-følelse.
Kameraet bruger fortsat den faktisk viste boldposition og de faste styringsakser.
Afspilning, afspark, viewportskift og retur fra baggrund nulstiller rent.
Reduceret bevægelse bruger roligere dæmpning uden det nye feedforward-led.

### Kampflow og lydsignaler

`match-flow.js` udleder KICK_OFF, PLAYING, GOAL_SCORED, HALFTIME, FULL_TIME og
eksisterende dødbolde fra motorens faktiske state. Den muterer eller fremfører
ikke simuleringen. En reserveret FREE_KICK-mapping er ikke et nyt frisparkssystem.
Gameplayinput tillades kun i PLAYING; det forhindrer tabte/efterhængende tryk
omkring den sidste afsparkstick og under en dødbold. Taktiske kommandoer har
fortsat deres egen gyldige sti. Eksisterende centerafspark og afvikling bevares.

Et nyt mål i R3 kan få ét kort målfløjt sammen med net/publikum. Genåbnet score
er kun en baseline. Halvleg og fuldtid har forrang med deres egne signaler, så
de ikke samtidig får et ekstra målfløjt. Lokal mute, lydfiler, throttling,
voice-loft og baggrunds-/resume-beskyttelse er bevaret fra TEST55.

## Verifikation og grænser

Nye direkte tests dækker pointer-ejerskab/cancel, joystick, uændret akseskift,
øjeblikkelig og begrænset DOM-feedback, kritisk HUD, kommando/engangsinput,
fire-inputs-indhentning og identisk fuld uploadpakke/sluttilstand. De dækker også
kontaktsikkerhed, spillerens egen kliptid, overgangshysterese, positiv/negativ
vending ved 30/60/120 Hz, faktisk GLB-fodfæste, kampfaser og målfløjt uden genafspilning.

Browsermålingen sammenligner TEST55 og TEST56 med samme isolerede R3-fixture og
Enkel grafik. Den måler fra DOM-pointerdown til synlig ladningsindikator efter
appens eventhandler. Det er en lille softwaremåling, ikke en fysisk telefonmåling
eller en garanti for alle tryk. Endelige målinger, testoptælling og APK-kontrolsum
ligger i PDF og `test-evidence/direct-TEST56-*`.

R2-checksum `4ad518a8d5fe454a76cbca4345f0f2294a1b6e7fddb3f98c9d17dad47d6d6f42`
og R3-checksum `274b4d45a4fae126f62e3e9d79f7c76e9bc8eca0aa6d59fcfcc1203961fe1e10`
bevares. Ingen ændring af shared/, worker/, native Android-kode eller TEST55's
binære ressourcer. APK 37, tidligere APK/PDF, motor 1–10, R1/R2, optagelser,
testcertifikat/app-id, lokale valg, main og offentlig hjemmeside v56 er bevaret.
Lancering er fortsat 1. januar 2027 kl. 10.00 København / 09.00 UTC.

**Fysisk OnePlus Nord 4 er ikke tilgængelig.** 60–120 FPS, finger-til-pixel-latens,
installation, varme og batteri er ikke fysisk verificeret. Ved faktisk under fem
FPS kan fire-inputsgrænsen stadig ikke indhente 20 Hz-simuleringen. AI-valg,
duel-/frisparksregler, skudusikkerhed og de deterministiske boldprofiler ændres
ikke i denne kompatible R3-klientopdatering. Nye regler kræver en ny version.

## Kort fysisk prøve

1. Opdater oven på Touchline TEST uden afinstallation. Start på Auto/60.
2. Flyt tommelfingeren lidt fra centrum, sprint med en anden finger og slip
   sprint uden at slippe styrepuden. Retning og bevægelse skal bevares.
3. Prøv et kort B-tryk, hold/slip B, et kort skud og et doseret skud. Se efter
   hurtig feedback under minikortet, rettidig sparkepose og bold, der forlader foden.
4. Prøv 90/180-graders vendinger, løb/sprint-skift og finte i fart. Se på
   fodfæste, overkrop og kamera. Mærk efter unødigt efterslæb ved stikning/skud.
5. Kontrollér afspark/halvleg/mål/slut, målfløjt og en kort baggrund/retur uden
   gamle signaler. Hent ydelsesrapport og kampbackup efter prøven.

## Kildeliste

Afsluttet kontrol: **773 beståede, 0 fejl, 0 skip, 0 annulleret** på kildecommit
`a02c0b0abdec691865dec3c25b8896b7a848847f`. Den signerede TEST56 er
47.133.453 bytes (47,13 MB), versionkode 56, `1.0.0-test-direct56`.
APK-SHA-256: `4719cb4c5ae93fd17cba880fdbe4404554e15f10879d557e2eed3e13c6416200`.
Alle 43 pakkede webfiler er kontrolleret byte for byte; testcertifikat/app-id
stemmer med den tidligere aflevering.

Én isoleret DOM-prøve gav 131,1 ms til synlig ladningsindikator i TEST55 og
1,2 ms i TEST56 med Enkel-grafik. Det måler kun softwarefeedback efter pointerdown,
ikke fysisk touch, udført spark eller synlig pixel på telefonen. En anden
diagnostik målte otte inputforbrug med gennemsnit 23,1 ms og maksimum 45 ms;
det er ikke et statistisk telefonbenchmark. Fire-inputsloftet er uændret.

Chromium kontrollerede den faktisk pakkede klient i Auto/Skarp, otte lyddekodninger,
kort/fokus, PRBK/HAIF, fullscreen og retur til menu samt JSON-eksport. Ingen
konsol-/runtimefejl eller forsøg mod eksterne værter blev registreret i disse
isolerede fixtures. Software-WebGL's lave FPS siger ikke noget om OnePlus Nord 4.
Kilde-/APK-/PDF-evidens og komplet ændringsliste findes i `test-evidence/direct-TEST56-*`.

- `src/ManualMatch.jsx`, `src/direct-match-input.js`, `src/match-joystick.js`
- `src/player-action-sample.js`, `src/asset-player-animation.js`, `src/pro-player.js`
- `src/football-swing.js`, `src/manual-scene.js`, `src/match-prediction.js`
- `src/living-camera.js`, `src/match-flow.js`, `src/stadium-console.css`
- `src/match-performance-log.js`, `src/match-audio-feed.js`, `src/MatchSoundControl.jsx`
- `tests/direct-feel.test.mjs`, `package.json`, `dev/test-release.json`
- Denne dokumentation, TEST-ANDROID.md, TEST56-APK/PDF og direkte testevidens.
