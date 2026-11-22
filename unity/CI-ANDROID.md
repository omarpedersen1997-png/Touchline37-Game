# Automatisk Unity Android-test-APK

Kun `codex/unity-66-foundation`, projekt `unity/TouchlineUnity`, Unity
**6000.6.10f1**. Push starter workflowet; `workflow_dispatch` er også defineret.
Begge jobs afviser main, andre branches, tags og kopier af repositoryet.
Ingen merge, udgivelse, deployment eller forbindelse til produktionen.

## 1. Windows: den korrekte licensvej

**Den ønskede gratis Personal-vej med `.alf` → `.ulf` er ikke understøttet af
Unity 6.6's manuelle aktivering.** Unity henviser Personal til Unity Hub. Jeg
angiver derfor ikke en `.alf`-kommando som en fungerende Personal-løsning.
En Windows-maskines aktiveringsanmodning må heller ikke uden videre behandles
som en licens til en anden CI-maskine.

GameCI dokumenterer følgende Personal-metode, **hvis din Hub faktisk leverer en
`.ulf`**. Den er implementeret i cloud-jobbet, men er endnu ikke aktiveret eller
afprøvet for din konto:

1. Installer Unity Hub og **6000.6.10f1** med **Android Build Support**, **Android
   SDK & NDK Tools** og **OpenJDK**. Log ind i Hub. Vælg **Preferences → Licenses →
   Add → Get a free personal license**, hvis denne mulighed findes for din konto.
2. Se efter `C:\ProgramData\Unity\Unity_lic.ulf`. Hvis filen findes fra netop
   denne aktivering, kopieres **filens tekstindhold**, ikke filstien eller en
   `.alf`. Upload aldrig filen til Git eller chatten.
3. På GitHub: **Touchline37-Game → Settings → Secrets and variables → Actions →
   New repository secret**. Opret `UNITY_LICENSE` med tekstindholdet. GameCI
   kræver desuden `UNITY_EMAIL` og `UNITY_PASSWORD` som separate Secrets. Indtast
   dem direkte hos GitHub; del dem aldrig her. Konto-/MFA-politikker kan stadig
   blokere denne type CI-login.
4. GameCI anbefaler at frigive den lokale Personal-aktivering ved at logge ud
   af Hub før cloud-bygningen, hvis en optaget plads blokerer CI. Gør dette kun
   ved cloud-metoden, **ikke** ved Windows-runner-metoden nedenfor.
5. Hvis din Hub ikke opretter en kompatibel `.ulf`, **stop denne licensvej**.
   Omdøb ikke andre licens-/tokenfiler, rediger ikke licensen, og slå ikke MFA
   fra. Brug Windows Personal-runneren nedenfor eller en understøttet CI-licens.

### Gratis alternativ: din Windows-PC bygger, GitHub afleverer APK'en

Denne mulighed bruger din lovligt aktiverede lokale Personal-editor. Den
kræver ingen `UNITY_LICENSE`, `UNITY_EMAIL` eller `UNITY_PASSWORD` på GitHub.

1. Aktivér Personal gennem Hub, åbn projektet én gang, og afslut import og evt.
   input-backend-genstart. Luk editoren før CI. Forbliv logget ind i Hub.
2. På GitHub: **Settings → Actions → Runners → New self-hosted runner → Windows →
   x64**. Følg GitHubs download-/konfigurationstrin på PC'en. Tilføj label
   **`touchline-unity-6000-6`**. Start runneren interaktivt under **samme
   Windows-bruger som Hub**, ikke som SYSTEM/service uden brugerens licens.
   Windows skal holdes vågen, og runneren skal være online under bygningen.
3. **Settings → Secrets and variables → Actions → Variables → New repository
   variable**: navn `UNITY_BUILD_RUNNER`, værdi **`windows-personal`**.
   Hvis editoren ligger et andet sted end standardinstallationen, tilføj også
   variablen `UNITY_EDITOR_PATH` med den fulde sti til `Unity.exe`.
4. Opret testsignerings-Secret fra næste afsnit. Et efterfølgende push til
   Unity-branchen vælger Windows-jobbet i stedet for GameCI-containeren.

Repositoryet er offentligt. Runneren kører kun den aftalte branch og ingen
pull requests, men kode på den branch køres stadig på din PC: giv kun betroede
personer skriveadgang, brug en separat Windows-bruger uden produktionsnøgler,
og godkend aldrig ukendt kode på branchen. Denne opgave installerer eller
registrerer ikke en runner på din PC.

## 2. Vedvarende, særskilt debug-signering (begge metoder)

Cloud-runnere må ikke generere en ny nøgle ved hvert build; så kan nye APK'er
ikke opdatere den samme testapp. Opret derfor **én ny Unity-testnøgle**. Genbrug
ikke APK 37's eller Capacitor TEST's nøgle. Password/alias nedenfor er Androids
offentlige debug-standard; den private nøgle er stadig hemmelig.

Åbn PowerShell på Windows. Kør dette én gang; det stopper, hvis filen findes:

```powershell
$keytool = 'C:\Program Files\Unity\Hub\Editor\6000.6.10f1\Editor\Data\PlaybackEngines\AndroidPlayer\OpenJDK\bin\keytool.exe'
$keyFolder = Join-Path $env:LOCALAPPDATA 'TouchlineUnitySigning'
New-Item -ItemType Directory -Path $keyFolder -Force | Out-Null
$keyFile = Join-Path $keyFolder 'touchline-unity-ci-debug.keystore'
if (Test-Path -LiteralPath $keyFile) { throw 'Filen findes allerede. Bevar den eksisterende Unity-testnoegle.' }
& $keytool -genkeypair -keystore $keyFile -storetype JKS -alias androiddebugkey -keyalg RSA -keysize 3072 -validity 10000 -storepass android -keypass android -dname 'CN=Touchline Unity TEST, O=OPNext Games, C=DK'
if ($LASTEXITCODE -ne 0) { throw 'Noeglen blev ikke oprettet.' }
[Convert]::ToBase64String([IO.File]::ReadAllBytes($keyFile)) | Set-Clipboard
```

På GitHub: **Settings → Secrets and variables → Actions → New repository
secret**. Navn: **`UNITY_ANDROID_DEBUG_KEYSTORE_BASE64`**. Indsæt fra udklipsholderen
direkte som Secret. Ryd derefter udklipsholderen (`Set-Clipboard -Value ''`).
Base64 er **ikke kryptering**. Bevar originalfilen privat og tag en krypteret
lokal backup; del den ikke i chat, Git eller artefakter. Er stien til Unity
anderledes, skal kun `$keytool` i eksemplet tilpasses.

Unity-testappens id er **`dk.touchline.footballidle.unitytest`**. Den installeres
ved siden af APK 37 og den tidligere Capacitor TEST. Efterfølgende Unity-test-
APK'er bruger samme nøgle og stigende `versionCode` (`1001 + run_number`).
Skift eller slet ikke Secrets-nøglen mellem opdateringer. En manuelt bygget
Unity-APK med en anden nøgle kan ikke opdateres med CI-nøglen; afinstallér ikke
en sådan app uden særskilt backup af dens data.

## 3. Automatisk og manuel kørsel uden ændring af main

Et push til **`codex/unity-66-foundation`** starter workflowet. Manglende Secrets
giver en tydelig fejl; der bliver ikke uploadet en falsk/ufærdig APK.

GitHubs **Run workflow**-knap kræver normalt workflowet på standardbranchen.
**Vi lægger det ikke på main og ændrer ikke standardbranchen.** Når workflowet
har været kørt via push mindst én gang, beskriver GitHub manuel dispatch mod
en branch via CLI/API. På Windows med GitHub CLI og din egen GitHub-login:

```powershell
gh workflow run unity-android-build.yml --repo omarpedersen1997-png/Touchline37-Game --ref codex/unity-66-foundation
```

Hvis GitHub endnu ikke har registreret workflowet til dispatch, bruges første
push. Fra Android kan du åbne en eksisterende kørsel i browserens
**Computervisning → Re-run all jobs** for at gentage **samme commit**. Dette
henter ikke nyere kode og kræver repositoryets Actions-skriverettighed.
Hvis **Run workflow** vises, vælg altid Unity-branchen. Job-guard afviser main
selv ved en fejlvalgt manuel ref. Ingen af metoderne merger eller deployer.

## 4. Download APK på Android

1. Log ind på [GitHub Actions](https://github.com/omarpedersen1997-png/Touchline37-Game/actions).
2. Åbn **Touchline Unity Android TEST** og vælg en **grøn** kørsel på
   `codex/unity-66-foundation`. Brug evt. Chromes **Computervisning**.
3. Rul til **Artifacts**, tryk **Touchline-Unity-Android-…**, og download ZIP'en.
   Den opbevares i **14 dage**. Den kan downloades af personer med læseadgang;
   repositoryet er offentligt. Artefakterne indeholder ingen private nøgler.
4. Åbn ZIP'en i Androids Filer/Files, udpak, og tryk
   **`Touchline-Unity-Test.apk`**. Tillad om nødvendigt installation fra Filer.
5. APK'en hedder **Touchline UNITY TEST**. Behold APK 37 og Capacitor TEST.
   ZIP'en indeholder også SHA-256, offentligt certifikat og build-info med
   commit og version. Kørslens Summary viser APK-størrelse og kontrolsum.

## 5. Hvad der faktisk kontrolleres

- Pinned GameCI v4 + præcis Android-container fra serie 4, 2 GiB delt hukommelse.
- Isoleret ARM64/IL2CPP-development-APK; aldrig AAB eller produktionstestnøgle.
- Importkontrol af animationer, specifik editor, branch og test-app-id.
- APK-signaturen verificeres med `apksigner`; `aapt` kontrollerer app-id og
  versionCode mod metadata for netop den aktuelle commit/kørsel.
- Kun APK, `build-info.json`, `SHA256SUMS.txt` og `certificate.txt` uploades.
  Ingen licenser, keystores, caches, saves eller rå Unity-logs i artefaktet.
- Der er ingen hård APK-størrelsesgrænse, automatisk deployment eller main-write.

**Afgrænsning:** Workflowets struktur og branch-sikring kan testes uden Unity.
Før en grøn reel kørsel er editorimport, Unity API-kompilering og APK-bygning
ikke verificeret. En grøn bygning beviser heller ikke installation, opstart,
touchrespons eller FPS på OnePlus Nord 4; det kræver fysisk test.

### Kilder og anvendt Unity-vejledning

- [Unity 6.6: manuel aktivering](https://docs.unity3d.com/6000.6/Documentation/Manual/ManualActivationGuide.html)
- [GameCI: licensaktivering](https://game.ci/docs/github/activation/)
- [GameCI: builder](https://game.ci/docs/github/builder/)
- [GitHub: workflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)
- Unity-skill: `using-unity`, `unity-cli.md`, `auth-license-cloud.md`,
  `common-workflows.md` og `build-run-test.md` er læst til denne opgave.
