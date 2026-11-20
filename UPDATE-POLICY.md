# Aflevering af Touchline-opdateringer

Brugerens krav fra 15. november 2026: Hver færdig, afleveret opdatering skal have
en PDF-rapport og en separat Android-test-APK. Interne delændringer samles i den
tilhørende opdatering; rapporten og APK'en afleveres sammen, når kontrollen er færdig.

- Brug et nyt, entydigt versionsnavn for APK, rapport og måledata. Bevar allerede
  afleverede versioner og den originale APK 37.
- Rapporten beskriver det konkrete problem, ændringer, faktiske testresultater,
  målinger, APK-identitet/kontrolsum, afgrænsning og afprøvning på Android.
- Skriv aldrig passwords, private nøgler, signeringsnøgler, sessioner eller
  adgangstokens i rapporten, dens JSON-grundlag eller Git.
- Angiv tydeligt, når fysiske Android-FPS eller telefonadfærd endnu ikke er målt.
  Desktop-CPU, renderpixelbudgetter og HTTP-ventetid må ikke kaldes telefon-FPS.
- Testappen skal kunne opdateres oven på den eksisterende Touchline TEST med
  samme test-app-id og testcertifikat. En ny test-version må ikke erstatte APK 37.
- Ingen automatisk merge eller ændring af den aktive hjemmeside/produktion.

PDF-generatoren bruger projektets eksisterende fonte og farver:

```sh
python dev/reports/build-update-pdf.py --input test-evidence/performance-v38.json
```

Standardoutput er `dev/artifacts/Touchline37-Opdateringsrapport-TEST38.pdf`, når
`update.id` er `TEST38`. Finalgenerering kontrollerer den refererede APK-fil under
`dev/artifacts/` mod rapportens faktiske filstørrelse, SHA-256 og ZIP/CRC.
`--draft` kan bruges under forberedelse; kladder markeres tydeligt og afleveres
ikke som en færdig opdatering. `--overwrite` er kun til egen genereret kladde eller
rapport før aflevering, ikke til at overskrive tidligere afleverede versioner.

Selve APK-bygning, signaturkontrol og telefonafprøvning er særskilte kontroller.
En PDF, der kan åbnes, er ikke i sig selv et bevis for, at spillet er lagfrit.
