# Touchline — kerne-loop, TEST49

## Eksisterende struktur

| Lag | Vigtigste filer | Eksisterende funktioner |
|---|---|---|
| UI og handlinger | src/App.jsx, SquadPitch.jsx, ClubManagement.jsx, PlayerCareer.jsx | Opstilling, bytte af spillere, træning, køb/salg, taktik, karriere og klub |
| Servertilstand | worker/game.js, worker/index.js | Handlinger, økonomi, afvikling, lagring, CAS/idempotens og brugeradskillelse |
| Hold og økonomi | worker/management.js, worker/progression.js | Startellever, forkert-position-straf, træner, træning, potentiale, sponsorer, billetter, personaleudgifter og otte timers offlineindtægt |
| Personlig karriere | worker/player-career.js, worker/player-journey.js | Egne egenskaber, XP, træning, form/energi, restitution, kontrakter og kampe |
| Progression | worker/competition.js, worker/europe.js, worker/expansion.js, worker/career.js | Stigende pointkrav, licenser, Sæsonpokal, Aurora Europa Cup, forskning, DNA og mål |
| Motorer | shared/arcade.js, shared/football-engine11.js og tidligere versionsfiler | Deterministiske optagelser, boldkontakt, AI, målmænd, mål, genstarter, to halvlege, formations-/taktikkommandoer |
| Native | android/, src/api.js, src/match-display.js | Testidentitet, native netværk, Android Tilbage og kampens immersive visning |

## Forbundet i denne opdatering

- shared/team-strength.js samler den eksisterende styrkeformel. Serverens selectedStrength og den nye SquadAnalysis forklarer samme beregning. Nye spilregler indføres ikke.
- Den versionerede kampstart sender formation og taktik med til motoren. Forespørgsler uden motorversion bevarer med vilje den gamle apps protokol. Ingen historisk optagelse omskrives.
- Startellever, forkert position, træningsniveau, potentiale, træner og DNA-bonus indgår. Taktik og formation sendes særskilt til kampmotoren; en offensiv taktik må ikke fejlagtigt præsenteres som en gratis stigning i den samlede rating.
- Integrationstests følger køb → startellever/reserver → træning → formation/taktik → kampkonfiguration og UI-styrke. Nettorate og offlinegrænse testes særskilt.
- Den manuelle klient indhenter efterslæb i små portioner. Fysik, inputs og slutpakke bevares. Live-hændelser afledes alene af faktisk registrerede skud, redninger og mål.

## Det er ikke nyimplementeret eller færdiggjort her

- Managertruppen har ikke et komplet vedvarende form-, skades- og træthedssystem. Energi/restitution findes i spillerkarrieren og i kampen. Der vises ikke opdigtede managerdata.
- Motor 11 har ikke komplette offside-, frisparks-, straffe-, kort- og indskiftningsregler. Disse må ikke kaldes færdige, fordi der findes en UI-tekst eller en formationskommando.
- Hastighedskontrol af en aktiv servervalideret manuel kamp kan ikke blot ændre tiden: inputs, frist og replay skal fortsat passe sammen. Ingen sådan regelændring indføres her.
- Nye AI-regler, økonomiregler og managerform kræver en særskilt, versioneret spilregelopdatering og egne migration-/kompatibilitetstests. Historiske motorer og optagelser må ikke overskrives.

## Sikker videreudvikling

Arbejd fortsat på udviklingsbrancher og isolerede testdata. Ingen merge til main, produktionsdatabase eller offentlig deployment er gennemført i denne opdatering. Testserverens nuværende adfærd bevares; styrkeformlen er matematisk uændret. Browserens layoutkontrol er ikke en fysisk Android-FPS-måling.
