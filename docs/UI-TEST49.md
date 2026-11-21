# TEST49 — ændrede filer og designregler

## Ensartet design

`src/touchline-tokens.css` findes identisk i spil- og website-repositoriet.

| Token | Værdi/formål |
|---|---|
| --tl-bg | #0b253a, marineblå baggrund |
| --tl-surface | #15374b, kort og formularer |
| --tl-surface-raised | #21495e, sekundære handlinger |
| --tl-accent / --tl-on-accent | #c1f66b / #14362b, lime og mørk tekst |
| --tl-text / --tl-muted | #ecf4f3 / #b7cdd7, høj kontrast |
| --tl-border | #547e8b66 |
| --tl-radius-sm / --tl-radius-card | 6 / 10 px |
| --tl-space-1/2/3/4/6 | 4 / 8 / 12 / 16 / 24 px |
| --tl-type-body/label/meta | 16 / 14 / 12 px |
| --tl-ease | 160 ms; reduceret bevægelse respekteres |

Knapper, primær/sekundær handling, kort, fokusringe og kontaktfelter bruger fælles regler. Kampkontrollernes forskellige farver og den grønne bane bevares.

## Opstilling og menuer

- `src/SquadPitch.jsx`: separate bane- og detaljeområder; alle elleve spillerhandlinger og de eksisterende tekster bevares.
- `src/squad-layout.js`: visningskoordinater fordeler rækker og kæder med mere luft. Simulationskoordinater og spillerroller ændres ikke.
- `src/stadium-console.css`: `.game-squad-panel`, `.game-squad-details`, `.game-squad-players`, `.game-squad-player`, navnebadges, rating-/nummerplacering samt footer-padding. Reserveknappen har bundluft og en fast synlig placering i det rullende sidepanel.
- På lave landskabsskærme må menuen rulle lidt som et dokument, så banen ikke bliver presset flad. På højkant stables bane og klubkort uden vandret scroll.
- `src/LeagueStandings.jsx`, `src/EuropeCompetition.jsx`, `src/App.jsx`: kompakt tabel, lokal tabelrulning, flytning af rundens resultater til Resultater og turneringsvalg, der følger orienteringen. H1 bevares til hjælpeteknologi uden en ekstra stor titelrække.

## Kamp og opstart

- `src/manual-session.js`: motor 11 indhenter højst fire inputs pr. billedkald; der droppes ingen inputs eller fysikticks. Engangsinput/kommandoer forbruges først, når den aktuelle tid er indhentet.
- `src/manual-scene.js`: enkel grafik cacher den statiske bane, udnytter bredformat, har tydeligere optegning og forudsiger visningspositioner mellem ticks. 3D bevarer den eksisterende rAF/prediktion og viser den styrede spillers nummermarkør.
- `src/match-camera.js`, `src/ManualMatch.jsx`: skærmrelativ styring følger også den roterede 2D-bane.
- `src/MatchLivePulse.jsx`, `src/match-event-feed.js`: lille live-HUD med faktiske skud, boldbesiddelse og seneste mål/redninger/afslutninger. Ingen opdigtede kort eller statistik.
- `src/match-display.js`: eksplicit udvidet kampvisning og oprydning efter fullscreen. Android-manifest og MainActivity låser ikke menuerne i landskab; kamp-pluginens midlertidige orientering bevares.
- `src/AppStartup.jsx`, `src/startup-gate.js`, `src/startup-splash.css`, `src/AppChrome.jsx`: kort, skippelig opstart, højst 1,5 sekund, lokal til/fra-indstilling i Mere og fjernelse fra DOM.

## Hjemmeside

- `src/stadium-site.css`: naturlig højde på forsiden, harmoniseret afstand mellem hero/links/countdown, fulde labels, mørkt play-ikon, hover/fokus og footer tæt på indholdet med bund-padding.
- `src/StadiumIllustration.jsx`: valgfri sikker margen i SVG-viewBox, så projektørernes T-former ikke klippes.
- `src/MatchPreview.jsx`, `src/WebSupport.jsx`: en tydeligt mærket, original vektorillustration af aflevering/løb på kampsliden. Kun lette transform-animationer; reduceret bevægelse understøttes. Det er ikke et screenshot eller et løfte om appens grafikniveau.
- Lanceringstidspunkt, serverbekræftet åbning, dansk indhold og de eksisterende navigationsmål bevares. Orienteringsvejledningen er opdateret til menuer på højkant og kampe i bredformat.

## Kerne-loop og begrænsninger

Se `CORE-LOOP-AUDIT.md`. Nye fælles styrkeberegninger er matematisk identiske med de eksisterende regler. Managerform/skader, komplette offside-/kortregler og hurtigere servervaliderede manuelle kampe er ikke færdiggjort i denne etape.

Der er ingen merge til GitHub main, offentlig website-deployment, produktionsdataændring eller erstatning af APK 37. Browserkontrol bruger fiktive, lokalt afskårne data og er ikke en fysisk Android-test.
