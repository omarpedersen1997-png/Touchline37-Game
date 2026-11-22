# Touchline Unity – første samlede kerne

**Unity 6.6 / 6000.6.10f1 · URP 17.6.0.** Separat udviklingsbranch:
`codex/unity-66-foundation`. Lancering fastholdt: **1. januar 2027 kl. 10.00
Europe/Copenhagen / 09.00 UTC**. Ingen deployment eller merge.

Der er implementeret et dansk klub-/startflow, der åbner en ny lokal 11-mod-11-
kamp med bane, figurer, bold, kamera, joystick, knapper, kampflow og gemning.
**Unity Editor findes ikke i det aktuelle miljø. Runtime-/Editor-koden er derfor
ikke kompileret eller afspillet i Unity, og der er ikke bygget en Unity-APK.**
Den må først kaldes verificeret spilbar, når den faktisk er åbnet og testet i
editoren og på Android. C#-domænelaget er kompileret og testet særskilt.

## Det konkrete fundament

| Område | Implementering | Verifikation |
| --- | --- | --- |
| Holdstyrke | Positionsstraf, træning, potentiale, træner og klubbonus | 12 golden-fixtures mod eksisterende JS |
| Klub | Dansk trup, træning, formation/taktik, lokal økonomi, XP og kampbelønning | C#-regler testet; UI afventer Unity |
| Spilflow | Afspak, kort første aflevering, mål/genstart, indkast, hjørne/målspark, halvleg og fuldtid | C#-tests, inkl. 20 hele kampe |
| Bevægelse/AI | Acceleration, opbremsning, begrænset vending, energi, kæder, én primær presser og støttepositioner | C#-tests; visuel kvalitet uverificeret |
| Bold | Forskellige pasnings-/skudprofiler, luftmodstand, spin, hop, første touch, redninger/returbolde og træværk | 10 JS-sammenligninger + kamptests |
| Native visning | URP, tekstureret bane/linjer, stadiondele, FBX-figurer, Animator-overgange, numre og fokusmarkør | Implementeret; afventer Unity-import/afspilning |
| Kamera/input | Dæmpet broadcast, vist boldposition, roteret styrepude, separate pointer-ejere, tastatur, pause/reset | Implementeret; afventer Unity/telefon |
| Lyd | Eksisterende WAV, 8 stemmer, ambience, spark, redninger, net/publikum og fløjt, mute/baggrund | Implementeret; afventer Unity/telefon |
| Save | Versionsmærke, SHA-256, to slots, fallback, asynkron skrivning, aktiv kamp og præferencer | C#-roundtrip-/fejl-/idempotens-tests |

Unity-reglerne hedder **`touchline-unity-sandbox-v1`** og kører med 60 faste ticks
pr. sekund. Renderingen interpolerer position og kropsretning. Det er en ny,
isoleret simulator; den kan **ikke** validere eller afspille gamle Motor 11-
optagelser. De oprindelige motorer og replay-/serverregler ligger urørt i det
oprindelige projekt. Nye regler skal senere få særskilt servervalidering.

## Mappestruktur

```text
unity/
  TouchlineUnity/
    Assets/Touchline/
      Core/                Ren C#, uden UnityEngine
      Runtime/             URP-verden, input, kamera, lyd, dansk UI og bootstrap
      Editor/              Importregler, materialer, Animator-controller og Android-build
      Tests/Editor/        Seks NUnit/EditMode-tests (ikke afviklet her)
      Scenes/Touchline.unity
      Resources/Touchline/ Models, Textures, Audio, UI, Seeds og golden-fixtures
      SourceAssets55/      Originale GLB/licens-/proveniensfiler
    Packages/manifest.json
    ProjectSettings/       Fast editorversion og bootstrap-scene
  Tests/                   Selvstændig .NET-testharness; Core målretter netstandard2.1
  Tools/                   Eksport, FBX-konvertering, verifikation og rapport
  Evidence/                Faktiske test-/konverteringsdata og begrænsninger
```

`Core/ClubRules.cs` porter den eksisterende `shared/team-strength.js`-beregning.
`Core/BallPhysics.cs` bevarer de fem R3-profilers koefficienter og integration.
Legacy x/y på jorden bliver Unity X/Z; legacy højden z oversættes med -0,11 m,
så den nye bold har en fysisk radius på 0,11 m og Unity Y er højde. De 10
referenceprøver kontrollerer denne eksplicitte koordinatoversættelse. Den fulde
kamp er ikke et bitkompatibelt R3-port: timestep, AI, sammenstød og kampflow er
nye og versionsmærkede.

## Ressourcer og animation

De 31 eksisterende filer fra `public/match-assets55/manifest.json` er kopieret
byteidentisk; `Evidence/asset-transfer.json` angiver deres konkrete Unity-stier.
PNG/WAV ligger i Resources, GLB/licenser i SourceAssets55. Originalmanifestet er
proveniens; dets relative stier gælder det oprindelige `public/match-assets55/`.
Fem nye FBX-filer er afledt i Blender. Figur-FBX bevarer UV, 26 knogler og de 12
klip. Lokalt knogleradialt volumen fra TEST59 er overført til de afledte figurer;
de originale GLB-filer ændres ikke. En teknisk Blender-armaturhjælper filtreres
fra eksporten. Genimport i Blender verificerer det faktisk eksporterede indhold.

Editor-klargøringen opretter fire Animator-controllere med kliptilstande og
fælles URP-materialer. Basecolor/normal bruges på græs og dragter. De oprindelige
roughness-/nummer-/handsketeksturer er bevaret, men ikke alle er endnu mappet til
native URP-masker/materialekanaler; det skal kontrolleres i editoren. Løb/sprint
og handlinger krydsfades; der er endnu ikke motion matching, fuld fod-IK, nyt
mocap eller en færdig konsol-lignende animationsgraf.

FBX-strukturkontrol i Blender er **ikke** et bevis for fejlfri Unity-import.
Ingen Unity-skærmbilleder, Unity-FPS eller fysisk Android-test er opfundet.

## Åbn og test på en computer eller et buildmiljø

1. Installer **Unity 6000.6.10f1** gennem Unity Hub. Vælg **Android Build Support**,
   **Android SDK & NDK Tools** og **OpenJDK** fra netop denne editorinstallation.
   Unitys officielle metadata angiver OpenJDK 17.0.21+9. En gyldig Unity-
   aktivering er nødvendig. Ingen licens eller signeringsnøgle indgår i repoet.
2. Vælg *Add project from disk* og åbn `unity/TouchlineUnity`.
3. Lad de fastlåste pakker/importer blive færdige. Editorens klargøring opretter
   URP-asset, materialer og controllere. Menuen **Touchline → Klargør Unity-projekt**
   kan gentage klargøringen. Godkend editor-genstart, hvis Unity beder om den
   efter aktivering af input-backends. Kontrollér Console; ingen fejl må ignoreres.
4. Åbn `Assets/Touchline/Scenes/Touchline.unity`, og tryk **Play**.
5. Test klub/træning/taktik, vælg **Spil Unity-testkamp**, og prøv afspark,
   afleveringer, skud, pause, retur til klub og genoptagelse.
6. Kør **Window → General → Test Runner → EditMode**. De seks Unity-tests er
   leveret, men er ikke afviklet i dette miljø.

Tastatur: WASD/pile, **E** aflever/skift, **R** stikning, **Q** finte, **F** indlæg,
**mellemrum hold/slip** skud/tackling, **Shift** sprint og **Esc** pause.
På touch bruges styrepude og de mærkede knapper. Menuskærme tilpasser sig
portræt/bredformat; Android-kampen anmoder om bredformat, og orienteringen
ryddes op ved retur. Safe-area kommer fra `Screen.safeArea`.

De automatiske domænetests kan på en udviklermaskine køres fra repository-roden:

```sh
node unity/Tools/export-domain-fixtures.mjs
dotnet run --project unity/Tests/Touchline.Core.Tests.csproj -c Release
node unity/Tools/validate-project.mjs
```

.NET 10 SDK bruges kun til testharnessen; spillets Core kompileres mod **.NET
Standard 2.1 / C# 9**. Unity bruger sin egen Mono/IL2CPP-kæde, ikke .NET 10.

## OnePlus Nord 4 / Android

Der er **ingen Unity-APK endnu**. Unity-editoren alene kræver 9,13 GB installeret
plads; den mangler her, og tilgængelig plads rækker ikke til editor + Android-
moduler. Ingen Unity-buildaktivering er til rådighed i værktøjerne. Installer-
størrelsen er kontrolleret i den officielle release-API, ikke gættet.

Når et Unity-buildmiljø er til rådighed, vælger man **Touchline → Byg separat
Android-test-APK**. Metoden bygger ARM64/IL2CPP til
`Builds/Android/Touchline-Unity-0.1.0.apk` med app-id
**`dk.touchline.footballidle.unitytest`**. Unitys udviklingssignering bruges;
produktionsnøglen og det gamle Capacitor-TEST-certifikat åbnes ikke. Appen skal
ligge ved siden af APK 37 og Touchline TEST, og dens første lokale klub er
fiktiv. En fast Unity-testsigneringsidentitet skal sikres før efterfølgende
installerbare Unity-opdateringer afleveres.

Du bruger kun Android: du skal ikke udføre terminalkommandoerne på telefonen.
Projekt-ZIP er kildekode, som kan gemmes fra mobilen. Den kan ikke installeres
som en APK. En Unity-APK kan først leveres efter reel editor-/Android-bygning.
Den bevarede TEST59-APK er stadig den eksisterende Capacitor-app, ikke Unity.

Fem minutters telefonkontrol, når en Unity-APK findes: koldstart → klub →
afspark; styrepude + sprint med to fingre; aflever/stik/skyd; 90°/180° vending;
mute og baggrund/retur; menu i portræt; genstart og verificér samme lokale klub.
Mål derefter CPU/GPU-frame time, hukommelse, varme og batteri med Unity Profiler
på en fysisk telefon. 60/120 er mål/valg, ikke verificerede resultater.

## Save og sikkerhed

Unity bruger kun `Application.persistentDataPath/touchline-unity-sandbox-v1`.
To JSON-slots med kontrolsum og monoton revision sikrer fallback. Et snapshot
tages på ejertråden; disk-I/O køres serialiseret i en worker. Beskadigede slots
kopieres før erstatning. Fremtidige skemaversioner medfører skrivebeskyttelse.
Kampafregning er idempotent. Gemte Unity-kampe og lyd-/splash-/grafikvalg følger
med. SHA-256 er integritetskontrol, ikke kryptering eller serverbeskyttelse.

Den eksisterende webapps localStorage, konti, klubber og optagelser læses eller
ændres ikke. Automatisk overførsel fra dem er **ikke implementeret**. Unity har
ingen netværkstransport til produktion eller testserver; økonomi/idle er lokal
sandbox, ikke en ny produktionsøkonomi. Eksisterende Motor 1–10/R1/R2/R3,
R2-checksum, APK 37, gamle APK/PDF'er, main, DB, DNS og offentlig hjemmeside v56
bevares. Lanceringen er uændret. Der er ingen automatisk deployment.

## Størst fremgang i næste runde

1. **Åbn/kompilér i Unity 6000.6.10f1, ret faktiske importer/API-/shaderfejl, kør
   EditMode/PlayMode og byg den første signerede Unity-APK.** Det er den aktuelle
   blokering og vigtigere end flere uverificerede funktioner.
2. Profilér på OnePlus Nord 4: fødder/animationsbinding, bold/joystick/kamera,
   render-scale, draw calls, skindning, skygger, lyd og save-pause. Forbedr først
   det, profilerdata og fysisk spil afslører.
3. Byg en eksplicit, versionsstyret backend-/dataadapter og migrering med kopier.
   Overfør derefter klub/karriere/marked/liga/Europa i testmiljø. De gamle
   færdige systemer skal bruges som reference og testes mod golden-fixtures.
4. Udvid native animationslag, fysik/dueller/målmænd og fodboldregler. Offside,
   frispark/kort, udskiftninger og fuld liga-/karriereparitet er ikke færdige i
   denne første Unity-kerne. Ingen productionstilslutning uden særskilt godkendelse.
