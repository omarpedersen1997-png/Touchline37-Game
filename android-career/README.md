# Touchline til Android

TEST76 er en selvstændig Android-applikation til Android 8 og nyere. Androids launcher starter `TouchlineActivity`. Appen bruger det eksisterende testcertifikat og pakkenavn. Alle aktiver ligger i APK'en.

## Projektet

- `Career.java` ejer holdudtagelse, de to karriereveje, de seks baggrunde, fri karriere, kalender, pokal, kontrakter, missioner, træning og sæsonafslutning.
- `Motor12.java` simulerer 22 spillere i meter og sekunder med faste trin på 1/60 sekund. Choreographer leverer tiden. Stadionvisningen interpolerer mellem to tilstande. Hver halvleg tager 90 sekunder ved 1×. Uret viser 45 kampminutter.
- `StadiumView.java` tegner den perspektiviske bane med Android Canvas, animerede fodboldspillere, stadiongrafik, mål, radar og styrepude. Spillerfigurerne er bagt fra projektets licenserede, animerede modeller. `TacticsBoard.java` anvender motorens formationskoordinater.
- `Slots.java` og `SaveFormat.java` gemmer fire karrierer i Androids private fillager med atomisk filudskiftning, versionsfelt og SHA-256. Lagringen omfatter aktiv kamp, bold, spillerpositioner, tilfældighedsgenerator og kampstatistik.
- `TouchlineActivity.java` håndterer indlæsning, klubhus, brugerinput, lyd, safe areas, gemning og pause, når appen forlades. Kampmenuen har fire kameraer, statistik, en kronologisk tidslinje og lydstyrke. Joysticket anvender en radial dødzone på 15 %. Et længere tryk på A øger skudkraften. En gemt kamp genoptages med et aktivt tryk. Ved kampstart, efter mål og ved anden halvleg står bolden stille og to medspillere venter ved midterpletten. KICK OFF udløser fløjt, tilløb og en kort jordaflevering. I spillerkarrieren vælges Min spiller eller Hele holdet før hver manuelt spillet kamp.
- Cloudbackup bruger Androids Storage Access Framework. Spilleren vælger en dokumentudbyder og konto, f.eks. Google Drev. Eksport opretter et navngivet snapshot. Import validerer filen og bruger en ledig plads. Kontoadgang og netforbindelse håndteres af udbyderen.

## Byg

Brug JDK 17 eller 21, Android SDK Platform 36, Build Tools 36.0.0, Python. Byg fra repository-roden. Signeringsmappen skal indeholde projektets testkeystore og tilhørende lokale propertiesfil.

```sh
python android-career/build.py --sdk "$ANDROID_HOME" --jdk "$JAVA_HOME" \
  --signing "$TOUCHLINE_TEST_SIGNING_DIR" --output /tmp/Touchline37-Motor12-TEST76.apk
```

APK'en pakkes med aapt2, javac og D8, justeres med zipalign og signeres med apksigner. Alle fonte, lyde, billeder og spilleranimationer følger med under `android-career/assets`. Appikonet ligger under `android-career/res`. Motoren, aktiviteten og rendereren bygges direkte fra Java-kilderne.

## Test

`tests/CareerTest.java` køres direkte på JVM med domæneklasserne Career, Motor12 og SaveFormat. `tests/AndroidFlowTest.java` bruger Robolectric til at åbne appen med aktiver fra den signerede APK og gennemføre karrierevalg, kampstart, pause, genåbning og backup. `tests/PitchRenderTest.java` tegner Android-layoutet og tester kampinput med Robolectrics native grafik. JUnit-testene læser APK-stien fra systemegenskaben `touchline.apk`. `touchline.capture` kan angive en mappe til skærmbilleder.

Kør domænetestene fra repository-roden med JDK på PATH.

```sh
mkdir -p /tmp/touchline-career-tests
javac -d /tmp/touchline-career-tests android-career/src/dk/touchline/career/{Career,Motor12,SaveFormat}.java android-career/tests/CareerTest.java
java -cp /tmp/touchline-career-tests dk.touchline.career.CareerTest
```

Tribunebilledet er lavet til den native udgave. Grønsværen bygger på projektets græstekstur. `football-licenses.txt` i APK'en indeholder oplysninger om de oprindelige fodboldaktiver. TEST76 læser gemmepladser og dokumentbackups fra TEST75. Kameravinkel, lydstyrke og de nye kamptællere følger med i det nye format. Ældre kampe har ufuldstændige tællere for hændelser fra før opdateringen.
