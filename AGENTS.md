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

## Primært udviklingsspor fra 22. november 2026: Unity

- Brugeren har valgt **Unity 6.6 / 6000.6.10f1**, URP **17.6.0**. Fortsæt primært
  i `unity/TouchlineUnity/` på den særskilte Unity-udviklingsbranch. Se
  `unity/README.md` og `unity/AGENTS.md`; begynd ikke en ny app igen.
- Det eksisterende React/Capacitor-projekt og Motor 1–11 er bevaret som legacy-
  reference og fungerende tidligere leverancer. Det omdøbes ikke til Unity.
- Unity-kernen har egne versionsmærkede sandbox-regler og lokal save. Den må
  ikke kaldes kompatibel med gamle Motor 11-replays eller servervalidering.
- Native Unity-test bruger særskilt id `dk.touchline.footballidle.unitytest` og
  egen fremtidig testsignering; den eksisterende Touchline TEST-identitet,
  dens certifikat og APK 37 bevares.
- C#-domænetests og Roslyn-syntaks er ikke Unity Editor-/Android-verifikation.
  Lov aldrig en Unity-APK, fysisk spilbarhed eller FPS uden faktiske build-/
  installations-/måledata. Ingen nøgler eller Unity-licensfiler i Git.
