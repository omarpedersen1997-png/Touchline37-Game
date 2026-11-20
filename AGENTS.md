# Touchline 37 — udviklingskopi

- Fortsæt det eksisterende arbejde fra `claude/m5-del2` og Codex-udviklingsbranchene.
  Start ikke projektet forfra. Arbejd på en separat udviklingsbranch; ingen automatisk merge.
- Bevar APK 37, motor 1–10, originale motor 11 og eksisterende optagelser/data.
  Nye motor 11-regler skal have en særskilt, eksplicit revision i kampkonfigurationen.
- Brugerens nye udviklingsopgave tillader konkrete rettelser og nødvendige forbedringer
  i udviklingskopien. Brugeren har efterfølgende udtrykkeligt bestilt et samlet redesign af app og hjemmeside. Bevar logo, farveidentitet, data og funktioner; ny struktur og nyt layout er godkendt i udviklingskopierne.
- Ingen ændring af produktionsdatabase, playtouchline.dk eller dets offentlige udseende
  uden brugerens udtrykkelige godkendelse. Den godkendte offentlige testserver er
  `touchline37-engine11-test` med egen database og fiktive konti.
- Upload aldrig nøgler, adgangskoder, sessionsmateriale eller tokens til Git/rapporter.
  Test-APK bruger egen testidentitet og må ikke overskrive produktionsappen.
- Hver færdig opdatering afleveres med PDF-rapport og separat, signeret test-APK.
  Følg [UPDATE-POLICY.md](UPDATE-POLICY.md); bevar tidligere afleveringer.
- Kør relevante tests og bevar determinisme/kompatibilitet. Android-FPS må ikke kaldes
  verificeret på baggrund af Node-timings, beregnede renderpixels eller HTTP-målinger.
