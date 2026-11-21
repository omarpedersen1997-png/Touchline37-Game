# TEST55 – lokal 3D-, tekstur-, animations- og lydpakke

Udgangspunkt: TEST54, commit ca76fe9. Særskilt branch `codex/test55-rich-assets`.
Ingen merge eller deployment. Offentlig hjemmeside v56, APK 37, data, DNS,
testidentitet, tidligere afleveringer og motorfilerne bevares.

## Hvad der faktisk er ændret

Projektet havde allerede to skinnede MakeHuman-baserede GLB-spillere med
fotografiske hud-/øjenkort. TEST55 genbruger disse lovlige kilder og deres rig;
det er ikke et skifte fra nul modeller til fotorealistiske, nye personscanninger.
Den gamle native pipeline kopierede kun de to modeller. Den kopierer og
hash-verificerer nu en komplet lokal asset-pakke fra `public/match-assets55/`.

Den nye visuelle pakke vælges til Motor 11 R3. R1/R2 og motor 1–10 beholder deres
gamle model-/animationsvej. Ingen fysikregel, kontrolakse, simulerings-/uploadpakke
eller recording-format er ændret. Boldspor, glidende bold/kamera, kropsretning og
`player-grounding.js` bevares. Save-, splash- og lydnøgler er de samme.

## Modeller og animation

- `player-auto.glb` / `player-detail.glb`: henholdsvis 9.550 / 25.717 trekanter,
  26-joint skinning, normals, UV, PBR og eksisterende fotografiske hudkort.
- `keeper-auto.glb` / `keeper-detail.glb`: 10.318 / 26.485 trekanter, samme rig
  samt nye UV-mappede handskeskaller med håndknoglernes skin-vægte.
- Alle fire indeholder 12 reelle glTF-skeletklip: idle, walk, run, strafe_left,
  strafe_right, cheer, sprint, turn, pass, shoot, tackle og dive. De eksisterende
  CMU-baserede løbespor genbruges; fodboldhandlingerne er originale, kurvebaserede
  poser, ikke ny motion capture. De importerede spor bruges i renderingen.
- Drejning lægges på overkroppen oven på løbet, så benene beholder deres gangcyklus.
  Grounding anvendes fortsat efter posen. Et holdt replay fremfører ikke ganguret.
- `stadium-kit.glb`: originale modeller af buet udskiftningsbænk med sæder,
  overdækket trintribune med rækværk, siddende tilskuer, gittermast med lyskasser,
  bølget hjørneflag, UV-mappet bold, pulverlakeret målramme og vævet net.
  `stand-low` og `spectator-low` er ekstra mesh-LOD'er i samme GLB.
- Gentagne stadiondele og tilskuere bruger InstancedMesh. Auto bruger de lave
  LOD'er og færre tilskuere; Skarp bruger finere tribuner og lav tilskuer-LOD;
  eksplicit 4K bruger de detaljerede tilskuere. Det importerede mål skaleres efter
  banens faktiske mål og det importerede net bruger den eksisterende målreaktion.
- Eksisterende kvalitetsstyrede live-skygger bevares. Projektørernes emissive
  materiale reagerer langsomt på målfasen uden blink ved reduceret bevægelse.

## Teksturer – 16 PNG-filer

- Græs: color, normal og roughness i både 1024×1024 og 2048×2048.
- Trøjefabric: farve, normal og roughness i 1024×1024; shorts deler det vævede UV-kort.
- Støvlelæder, handskegreb og beton: 1024×1024.
- Originalt fiktivt TL-klubemblem: 1024×1024; stadionbander: 2048×512.
- Rygnummer-atlas: 1024×1024 og 2048×2048, delt mellem spillerne med separate UV-felter.

Auto vælger 1024-græs og nummer-atlas. Skarp/4K vælger 2048. Mipmaps og anisotropi
bevares; der oprettes ikke nye billedkort pr. frame. Ens kort-/materialeparametre
kan samles for trøje/shorts og sko uden at fjerne UV, tint eller skin-vægte.
Disse nye overflader er originalt genereret teksturkunst, ikke fotoscans. Modeller
bevarer de tidligere legitime fotografiske hud-/øjenkort. Handske- og beton-PNG
findes også indlejret i de selvstændige GLB'er.

## Lyd – otte PCM WAV-filer

Tre **optagede** publikumslyde af Gregor Quendel, CC BY 4.0:
`ambience.wav` (30 s stereo), `crowd-goal.wav` (7 s) og `crowd-chance.wav` (3 s).
Klip er beskåret, faded og lydtilpasset. Kredit vises i kampindstillingerne, og
licens/kilde/ændringer følger både repository og APK i ASSETS.md.

Fem **genererede**, filbaserede effekter: `kick-soft.wav`, `kick-hard.wav`,
`woodwork.wav`, `net.wav`, `whistle.wav`. De er ikke feltoptagelser. De genereres
offline, pakkes som 44,1 kHz PCM og afspilles fra AudioBuffers; den gamle tonale
fallback er bevaret ved dekoderfejl og i legacy-builds.

Ingen lydbuffer hentes/afkodes før lyd er aktiveret gennem brugerinteraktion.
Bufferne genbruges; højst otte samtidige stemmer inklusive det stille atmosfæreloop.
Mute/baggrund stopper stemmerne. Dispose afbryder fetch og ignorerer sen decode.
Der afspilles ikke gamle action-/mållyde ved genåbning. Ingen lyd-CDN eller nye
model-/lydafhængigheder er tilføjet.

## Build og budgetter

- APK og samlet kampkode var allerede uden hårdt loft efter TEST53. Det bevares.
- Samlede binære kamp-assets har nu en eksplicit `hardLimitBytes: null`-politik.
  25 MiB APK og 80 MiB assets er alene gennemgangsadvarsler.
- Opstartens 1,2 MB JavaScript-kontrol og hostingens separate Worker-kontrol
  bevares. Billeder, GLB og WAV indlejres ikke som ny base64 i Worker-JavaScript.
- `dev/build-performance-assets.mjs` kopierer hele pakken og dens licenser til
  Androids faktiske web-assets. Gradle pakker dem under assets/public/match-assets55.
- `npm run web:assets` laver en **lokal**, udtrykkeligt tilvalgt web-draft med
  samme binære pakke i web-draft/public. Dev-serveren kan servere disse filer;
  den offentlige hjemmeside og produktions-Worker genudgives ikke.
- Standardbuild beholder produktionsgrænserne. Isolationskontrollen fandt, at en
  direkte dev-import i build.mjs brød den eksisterende arkitekturgrænse; den
  fælles pakkefunktion ligger derfor i scripts/, ikke i testadapteren.
- `npm run assets:check` verificerer hashes, GLB-struktur, UV/normals, skin/clips og
  WAV-headere. `public/match-assets55/manifest.json` er den præcise filfortegnelse.
- Generatorer: `dev/assets/generate-pack.py`, `generate-stadium.py`,
  `generate-audio.py`, `write-manifest.mjs`. Binære resultater er med i repoet;
  Blender/Python er ikke runtimeafhængigheder på telefonen. Lydgeneratorens
  kildeoptagelser er de tre spor i den krediterede, eksterne MP3-kildesamling.

## Kontrol og ærlige grænser

Browserkontrollen af det første asset-importforsøg målte 1,21–1,26 mio. tegnede
trekanter. Stadion-LOD'er sænkede det til ca. 0,35–0,42 mio. i samme isolerede
Auto-fixture før den sidste sammenlægning af tøj. Det er en scenekompleksitets-
måling, **ikke** en fysisk FPS-forbedring fra APK54. Software-WebGL her kører kun
få frames pr. sekund og dokumenterer hverken OnePlus-FPS eller mobil-GPU-tid.

Nye tests kontrollerer reelle binære filer, klip, uafhængige skeletter, faktisk
støvlesålehøjde, to skinnede handsker, begge målnets koordinater, LOD-reduktion,
delte UV-materialer, lazy audio, buffer-cache, stemmeloft, mute og sen dispose.
Native-test kontrollerer hver enkelt pakket fil mod manifestets checksum.

Browserprøven kontrollerer faktisk efterspørgsel af modeller/teksturer/WAV,
Auto/Skarp, styreinput, fullscreen/retur og ydelses-/recording-eksport med fiktive
data. APK får særskilt signatur-, identitets-, CRC- og bytekontrol.
Den endelige testoptælling, APK-størrelse og SHA fremgår af PDF og test-evidence.

Der er ingen fysisk OnePlus Nord 4 i miljøet. 60–120 FPS, RAM-forbrug, varme,
batteri, faktisk hørbar balance og installation på din telefon er ikke verificeret.
Emulatorens hardwarekontrol melder manglende KVM/CPU-virtualisering. Der påstås
ikke AAA-fotorealisme, nye fysikregler eller et komplet licenseret lydstudie.

## Fem minutter på OnePlus Nord 4

1. Opdater oven på Touchline TEST uden afinstallation. Kontrollér bevaret klub,
   lydvalg og splash. Sammenlign menuopstart med første indlæsning af 3D.
2. Start en R3-kamp på Auto/60. Mærk fingerrespons, 90°/180°-vendinger, fødder,
   modtagelse, sprint, stikning og skud. Se boldspor og kamera ved retningsskift.
3. Slå lyd til og fra; lyt efter optaget baggrund og varierende spark. Skift kort
   til baggrunden: lyden skal stoppe, og retur må ikke gentage gammel jubel/fløjt.
4. Prøv Skarp 3D og se på græs, numre, mål/net og tribuner. Vend tilbage til Auto,
   hvis frame pacing forringes. Kontroller fullscreen og retur til portrætmenu.
5. Hent ydelsesrapport og kampbackup; se efter assetPack 55/textureSize 1024 eller
   2048. Afslut og kontrollér resultatlagring. Brug yderligere 10–15 minutter til
   en meningsfuld vurdering af varme, RAM-/appgenstart og batteri.

## Ændrede filer

Runtime: ManualMatch.jsx, manual-scene.js, pro-player.js, player-rendering.js,
match-sound.js, match-audio-feed.js, match-performance-log.js; nye moduler
match-asset-config.js, asset-player-animation.js, rich-match-assets.js og
match-sample-bank.js. Build: build.mjs, dev/build-performance-assets.mjs,
dev/local-server.mjs, dev/size-policy.mjs, dev/test-release.json, package.json,
scripts/release-check.mjs samt de nye scripts/package-match-assets.mjs og
scripts/verify-match-assets.mjs. Tests: native-performance-assets.test.mjs og
rich-assets.test.mjs. Derudover generatorer, asset-mappen, denne dokumentation,
TEST-ANDROID.md, TEST55-APK/PDF og test-evidence/assets-TEST55-*.
