# Touchline Unity på Windows

Projektet bruger **Unity 6.6 (`6000.6.10f1`)**. ZIP-pakken indeholder Unity-projektet, de oprindelige model-, tekstur- og lydressourcer, tests, build-scripts og GitHub Actions-workflowet. Den er baseret på Unity-branchen ved commit `7b3f0e5`.

1. **Installer Unity.** Hent [Unity Hub](https://unity.com/download), log ind og aktivér din Unity-licens. Åbn [installationen af 6000.6.10f1 i Unity Hub](unityhub://6000.6.10f1/40e81493c67d). Vælg **Android Build Support**, **Android SDK & NDK Tools** og **OpenJDK** til denne version.
2. **Udpak ZIP-pakken.** Brug **Udpak alle** i Windows, gerne til en kort sti som `C:\Touchline`. Vælg en ny mappe, hvis du allerede har en lokal projektkopi.
3. **Åbn projektet.** Vælg **Projects → Add → Add project from disk** i Hub. Peg på **`unity\TouchlineUnity`**, som indeholder `Assets`, `Packages` og `ProjectSettings`. Vent på den første import. Du kan trykke **Play** for at prøve den danske klubskærm og vælge **Spil Unity-testkamp**.
4. **Byg APK'en.** Afslut Play Mode og vælg **Touchline → Build Android Test APK** i Unity. Menuen skifter til Android og venter på import og kompilering. Se **Console** for resultat og fejl. APK'en ligger ved en vellykket bygning i **`unity\TouchlineUnity\Builds\Android\Touchline-Unity-Test.apk`**. Build-loggen ligger i samme mappe.
5. **Installer på telefonen.** Kopiér APK'en til Android, åbn den i **Filer**, og godkend installation fra Filer, hvis Android beder om det. Appen hedder **Touchline UNITY TEST** og har sit eget app-id. Hvis Android afviser en opdatering på grund af en anden signatur, så behold den installerede Unity-testapp, indtil dens lokale gemmedata er sikret.

Kildepakken er kontrolleret fil for fil. Unity-kompilering og fysisk Android-test afventer stadig. Den lokale bygning bruger Unitys egen debug-signering og kræver en aktiveret editor. Cloud-bygningen stoppede ved Unity-licenskontrollen i [seneste CI-kørsel](https://github.com/omarpedersen1997-png/Touchline37-Game/actions/runs/45019276975).

Se [CI-ANDROID.md](CI-ANDROID.md) for GitHub Actions og [README.md](README.md) for projektstruktur og tests. De anvendte Unity-referencer er `projects-templates.md` og `build-run-test.md`.
