# Touchline til Android

TEST75 er en selvstændig Android-applikation til Android 8 og nyere. Androids launcher starter `TouchlineActivity`. Appen bruger det eksisterende testcertifikat og pakkenavn. Alle aktiver ligger i APK'en.

## Projektet

- `Career.java` ejer holdudtagelse, de to karriereveje, de seks baggrunde, fri karriere, kalender, pokal, kontrakter, missioner, træning og sæsonafslutning.
- `Motor12.java` simulerer 22 spillere i meter og sekunder med faste trin på 1/60 sekund. Choreographer leverer tiden. Stadionvisningen interpolerer mellem to tilstande. Hver halvleg tager 90 sekunder ved 1×. Uret viser 45 kampminutter.
- `StadiumView.java` tegner den perspektiviske bane med Android Canvas, animerede fodboldspillere, stadiongrafik, mål, radar og styrepude. Spillerfigurerne er bagt fra projektets licenserede, animerede modeller. `TacticsBoard.java` anvender motorens formationskoordinater.
- `Slots.java` og `SaveFormat.java` gemmer fire karrierer i Androids private fillager med atomisk filudskiftning, versionsfelt og SHA-256. Lagringen omfatter aktiv kamp, bold, spillerpositioner, tilfældighedsgenerator og kampstatistik.
- `TouchlineActivity.java` håndterer indlæsning, klubhus, brugerinput, lyd, safe areas, gemning og pause, når appen forlades. En gemt kamp genoptages med et aktivt tryk. Ved afspark, halvleg og mål venter motoren på Kick Off.
- Cloudbackup bruger Androids Storage Access Framework. Spilleren vælger en dokumentudbyder og konto, f.eks. Google Drev. Eksport opretter et navngivet snapshot. Import validerer filen og bruger en ledig plads. Kontoadgang og netforbindelse håndteres af udbyderen.

## Byg

Brug JDK 17 eller 21, Android SDK Platform 36, Build Tools 36.0.0, Python og ffmpeg. Byg fra repository-roden. Signeringsmappen skal indeholde projektets testkeystore og tilhørende lokale propertiesfil.

```sh
python android-career/build.py --sdk "$ANDROID_HOME" --jdk "$JAVA_HOME" \
  --signing "$TOUCHLINE_TEST_SIGNING_DIR" --output /tmp/Touchline37-Motor12-TEST75.apk
```

APK'en pakkes med aapt2, javac og D8, justeres med zipalign og signeres med apksigner. Grafikken i `assets/kits.webp` er klar til bygning. Ved ændring af modellerne kan arket regenereres med `python android-career/tools/bake-kit.py` i projektets udviklingsmiljø.

## Test

`tests/CareerTest.java` køres direkte på JVM med domæneklasserne Career, Motor12 og SaveFormat. `tests/AndroidFlowTest.java` bruger Robolectric til at åbne appen med aktiver fra den signerede APK og gennemføre karrierevalg, kampstart, pause, genåbning og backup. `tests/PitchRenderTest.java` tegner Android-layoutet og tester kampinput med Robolectrics native grafik. JUnit-testene læser APK-stien fra systemegenskaben `touchline.apk`. `touchline.capture` kan angive en mappe til skærmbilleder.

Kør domænetestene fra repository-roden med JDK på PATH.

```sh
mkdir -p /tmp/touchline-career-tests
javac -d /tmp/touchline-career-tests android-career/src/dk/touchline/career/{Career,Motor12,SaveFormat}.java android-career/tests/CareerTest.java
java -cp /tmp/touchline-career-tests dk.touchline.career.CareerTest
```

Tribunebilledet er lavet til den native udgave. Grønsværen bygger på projektets græstekstur. `football-licenses.txt` i APK'en indeholder oplysninger om de oprindelige fodboldaktiver. TEST75 bruger sit eget karriereformat. Ældre klubdata i WebView-lageret indlæses ikke i de fire native pladser.
