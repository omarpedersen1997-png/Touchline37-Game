# TEST59 – kropsvolumen, støtteben, kontakt og ren kampstart

Udviklingsbranch: `codex/test59-app-cohesion`. Baseline: TEST58, commit
`2084e493041bd0fe395de0f981e3440b251d8dc8`. Ingen merge eller deployment.

## Konkrete årsager og rettelser

- Den eksisterende globale kropsskalering ændrede også lemmernes længde og gav
  stadig smalle tværsnit. `athlete-volume.js` udvider nu geometri radialt omkring
  modellens faktiske knogleakser i bind-pose: bryst 10–13 %, overarme 24 %,
  underarme 18 %, lår 28 %, lægge 26 %, fødder 12 % og hænder 16 %, med lokale
  forskydningslofter. Det er lokale radiale faktorer, ikke en garanti for samme
  procentvise silhuetændring i et kamerabillede. Maksimal målt vertexforskydning
  er 3,57 cm. Ledlængder, UV, skin-weights og de originale binære assets bevares.
  Afledt geometri caches og beregnes under klargøring med pauser mellem mesh.
  Ingen ekstra trekanter eller nye tegninger tilføjes af volumenændringen.
- Hele afleverings-/skudklippet erstattede løbet. Støttebenet brugte derfor en
  næsten stillestående pose, selv om kroppen bevægede sig. Det følger nu den
  igangværende gangcyklus; under opladning følger begge ben løbet. Sparkebenet
  beholder sit eget 7/10-tick-klip. Stående spark beholder den oprindelige pose.
- Tacklingens skrå rodrotation kunne føre støvlerne under græsset. Fodfæstet
  beregnes nu med den roterede rod for R3-tacklinger. Den gamle faste
  benoverskrivning bruges kun på de ældre modeller.
- Førsteberøring og tæt modstanderpres afspejles i diskret bryst-/armreaktion.
  Kun den aktuelle boldholder måler de eksisterende rivalpositioner. Der gives
  ingen ny boldbesiddelse, tackling, hitbox, AI eller fysisk fordel.
- Fokusnummer/-markør sad i fast højde, uafhængigt af figurens hoved. De følger
  nu hovedets allerede opdaterede matrix, uden en ekstra traversal af skelettet.
- R3-afleveringer/stikninger har ikke `lastAction.power`. Lydlaget behandlede dem
  derfor som ens svage spark. Det bruger nu den bekræftede boldhastighed, når
  power mangler. Nye modtagelser/redninger kan høres uafhængigt af lastAction.
  Det eksisterende bløde sparkesample genbruges dæmpet til kontakt; det er ikke
  en ny optagelse af en handske. Ingen nye lydfiler påstås.
- Før POST blev den gamle modelprofil klargjort; R3-modeller, materialer og første
  GPU-tegning skete efter serverens kampstart. R3-profilen og en faktisk scene
  klargøres nu først. Samme renderer/canvas overdrages til kampen, så arbejdet
  ikke gentages. Simulationsmotoren indlæses dynamisk ved kampklargøring, ikke
  som en ny tung opstartsafhængighed. Afbrudt/forældet klargøring ryddes op.
- Loadinglaget kunne fjernes før den første tegning/HUD-opdatering. Den faktiske
  state tegnes og snapshot af score, aktiv spiller og kampfase sættes først.
- Androids native baggrundssignal og DOM visibilitychange blev håndteret adskilt.
  De samles nu med deduplikerede overgange. Native listeners registreres én gang
  med aktuelle callbacks; sent returnerede handles fjernes efter unmount, og
  gammel getState må ikke overskrive en nyere baggrundshændelse.
- Fallback-oscillatorer blev ikke stoppet sammen med samples; fremtidige fløjt
  kunne overleve mute/baggrund. Begge deler nu et loft på otte stemmer og stoppes
  straks. Sen AudioContext.resume/dekodning kan ikke genstarte mute. Genåbning
  af en halvlegs-/sluttilstand genafspiller ikke det historiske fløjt.
  Et gemt lydvalg aktiveres også efter startknappens allerede registrerede
  brugerinteraktion, så første afspark ikke kræver et ekstra tryk på banen.
  Uden registreret brugerinteraktion beholdes den sikre gesture-fallback.

- Ved stor tidsrestance blev 3D-tegning stadig udført mellem de små
  fysikbatcher. Hvis en tegning tog 250 ms, kunne fire inputs pr. callback
  aldrig indhente en 20 Hz-simulation. Tegning holder nu kort pause ved mindst
  ét sekunds restance; callbacks fortsætter og tegnecadencen nulstilles rent.
  Ingen fysikticks droppes. I en udtrykkeligt syntetisk 250 ms-tegnemodel
  indhentes startrestancen på 800 ms mod ingen indhentning før ændringen.
  Dette er en scheduler-test, ikke en måling af telefonens FPS.

- Visuel kontrol afslørede også, at livekortet dækkede bunden af retningstippet
  under scoretavlen på lave skærme. Kortet placeres nu under sin egen
  retningsrække med safe-area og mindst seks pixels målt afstand i browseren.

## Bevis og afgrænsning

`test-evidence/cohesion-TEST59/` indeholder uretoucherede før/efter-skærmbilleder:

| Situation | Før | Efter |
| --- | --- | --- |
| Midtbane, tick 550, 915×412 | `before-915x412.png` | `after-915x412.png` |
| Samme tick, 390×844 | `before-390x844.png` | `after-390x844.png` |
| Nær mål, tick 928, 915×412 | `before-goal-915x412.png` | `after-goal-915x412.png` |
| Tre faktiske rigge, ens løbe-/sparkepose | `before-figures-pass.png` | `after-figures-pass.png` |

Samme seed, authoritative boldposition, kamera, opløsning og lys. Nærvisningen
har 29.642 trekanter og 48 draw calls i begge versioner. Det er en isoleret
modelinspektion, ikke kampens samlede tegnebudget. JSON indeholder de faktiske
værdier. Scripts i `dev/evidence/*59.mjs` kan gentage kontrollerne med Chromium,
Playwright og esbuild; alle HTTP-kald opfanges lokalt, ingen rigtig kamp startes.

Flowkontrollen bruger de faktisk pakkede webfiler og viser: R3-canvas klar før
fiktiv kamp-POST, samme canvas efter overdragelse, ingen forældreløse skjulte
hosts, første afslørede HUD i KICK_OFF, videre til PLAYING, backup og retur til
menu. Afspaksbilledet fastholdes ved første færdige frame via fixture-
baggrundssignalet; derefter genoptages den normale kamp. Menuer kontrolleres ved 320/360/384/390 px og lave/brede skærme, uden
vandret dokument-overflow, med seks genveje og `kr.`. Ingen runtime-/konsolfejl
eller kald til eksterne værter i disse fixtures.

## Hvad der ikke er ændret eller bevist

R3-reglerne og 20 Hz-simulationen er byte-uændrede. Boldens græs-/luftmodstand,
fart, spin, førsteberøringsregler, målmands-AI, pres og resultater er derfor ikke
omskrevet i denne version. Den eksisterende R3-interpolation, boldspor,
kameraafstand, pitch/lys og mål-/netsvar fra TEST58 er bevaret. Denne runde
forbinder figurer, lyd og opstart bedre med de eksisterende fysiske hændelser.

Der er stadig kun 12 eksisterende klip. Lagdeling og korrekt fodfæste er ikke
motion matching, fuld fod-IK, nye tackle-/dueloptagelser, ansigtsanimation,
stofsimulation eller fysisk muskelsimulering. GLB'ernes topologi/UV/rig sætter
fortsat grænser. 60/120 Hz tegning kan udjævne mellem 20 Hz-ticks, men kan ikke
skabe nye bekræftede fysikkontakter mellem dem eller garantere 8 ms inputlatens.
Ingen fysisk OnePlus-test er gennemført; vedvarende FPS, temperatur, batteri,
fingerlatens og faktisk Android-installation er ikke verificeret her.

APK 37, tidligere APK/PDF'er, shared/worker-regler, R1/R2/R3-checksums, optagelser,
main, produktionsdata og offentlig hjemmeside v56 bevares. Der foretages ingen
save-migration eller nulstilling af klub-, lyd- eller splash-valg.

## Fem minutter på OnePlus Nord 4

1. Opdatér oven på Touchline TEST uden afinstallation; kontrollér klub, lyd og
   splashvalg. Begynd med Auto/60 Hz.
2. Start en ny kamp: optakt → Gør banen klar → midterplet/afspark → kort aflevering.
   Scoren, aktivt nummer og HUD må ikke vise rester fra forrige kamp.
3. Løb med aflevering/skud, drej 90°/180°, sprint og finte. Se især støtteben,
   lår/læg, trøje og aktivt nummer. Sammenlign samme kameravinkel med TEST58.
4. Prøv rolig aflevering, stikning, opladt høj bold og skud med lyd. Første touch
   og spark skal have mere læsbar reaktion; de fysiske regler er de samme.
5. Mute midt i et fløjt, send appen i baggrunden og gå tilbage. Ingen gammel lyd,
   fast styrepude eller kamerahop. Luk kampen og kontrollér portrætmenuen.
   Spil derefter 10 minutter og eksportér ydelsesrapport for varme/FPS-vurdering.

## Ændrede kildefiler

- Figurer/animation: `src/pro-player.js`, `src/athlete-volume.js`,
  `src/asset-player-animation.js`, `src/ball-body-response.js`,
  `src/player-grounding.js`, `src/focus-marker.js`, `src/manual-scene.js`.
- Kampstart/HUD/tegnebudget: `src/App.jsx`, `src/ManualMatch.jsx`,
  `src/prepare-next-match.js`, `src/prepared-match-scene.js`,
  `src/match-hud-state.js`, `src/match-frame-pacer.js`,
  `src/stadium-console.css`.
- Livscyklus: `src/app-visibility.js`, `src/match-visibility.js`,
  `src/native-lifecycle.js`, `src/use-native-lifecycle.js`.
- Lyd: `src/MatchSoundControl.jsx`, `src/match-sound.js`,
  `src/match-sample-bank.js`, `src/match-audio-feed.js`.
- Verifikation/bygning: `tests/app-cohesion.test.mjs`, `package.json`,
  `dev/test-release.json`, de fire `dev/evidence/*59.mjs` scripts og billedbilagsgeneratoren,
  denne rapport og `test-evidence/cohesion-TEST59*`.

Den komplette filliste, APK-metadata og rapportgrundlaget gemmes sammen med
TEST59-artefakterne. Det originale `player-rendering.js` er undersøgt og bevares;
geometrien bearbejdes før dets eksisterende deling af skelet og sammenlægning
af beklædningsmesh. Der er ingen ny modelkonvertering i hvert render-frame.
