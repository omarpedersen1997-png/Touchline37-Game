# Touchline Unity

- Fortsæt dette projekt: `TouchlineUnity/`, Unity **6000.6.10f1**, URP **17.6.0**.
  Den officielle lanceringsdato er 1. januar 2027 kl. 10.00 København / 09.00 UTC.
- Arbejd på udviklingsbranch. Ingen merge til main, deployment, DNS-/domæne-/
  produktionsændring eller ændring af offentlig hjemmeside v56 uden godkendelse.
- Bevar eksisterende motorer, R1/R2/R3, R2-checksum, optagelser, APK 37 og gamle
  APK/PDF'er. Den nye Unity-sandbox er ikke en Motor 11-replayimplementering.
- `Core/` skal forblive uden UnityEngine, netværk og UI. Brug versionerede,
  sammenlignelige fixtures til overførte domæneregler. Hold Runtime/Editor adskilt.
- Bevar originalressourcer og licenser; arbejd på afledte kopier. Ingen kunstige
  APK-/asset-størrelseslofter. Profilér CPU/GPU/indlæsning i stedet for at gætte.
- Lokal Unity-test har eget save-namespace og app-id. Opret ingen forbindelse
  til rigtige klubber, produktion eller gamle localStorage-data under dække af
  automatisk migration. Brug eksplicitte, testede adaptere og datakopier.
- Brug samme sikre Unity-testsignering ved senere Unity-opdateringer, når en
  sådan identitet er etableret. Ingen private nøgler eller licenser i repoet.
- Kør de selvstændige C#-tests og projektkontrollen. Kør Unity EditMode/PlayMode,
  Android-build og fysisk telefonkontrol, når editoren er til rådighed. Rapportér
  præcist, hvis det ikke er muligt; C#-syntaks er ikke Unity API-kompilering.
- Aflever faktiske filer, testdata og en dansk PDF. En kilde-ZIP er ikke en APK.
