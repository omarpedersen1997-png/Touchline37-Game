# Touchline Motor 12

Motor 12 er et selvstændigt fodboldmanager-udkast i JavaScript. Hjemmesiden,
den browserlokale klub og 2D- og 3D-kampen bruger samme statiske build og
samme CSS. Previewet bruger opdigtede hold og spillere. Demoen har sit eget
matchobjekt i hukommelsen, og klubhuset gemmer sin tilstand på en særskilt
Motor 12-nøgle i browseren eller i Android-appen.

## Kør lokalt

```sh
node motor12/build.mjs
python -m http.server --bind 127.0.0.1 --directory motor12/dist 8012
```

Forsiden åbner på `http://127.0.0.1:8012/`. Klik **Start prøvekamp** for at
se afspark. Før først uret videre med **Kick Off**. Klubhuset er tilgængeligt
fra forsiden og fra prøvekampen.

`node --test motor12/tests/engine.test.mjs` kører simuleringstests. Den
valgfrie browsertest kræver Python Playwright og Chromium og køres med
`python motor12/tests/browser.py motor12/dist`.
Kør `python motor12/tests/arena-browser.py motor12/dist` for WebGL-kontrollen.
Buildet bruger repositoryets installerede esbuild og Three.js til arenaen.

## Kode

- `src/engine.js`, `physics.js`, `tactics.js` og `teams.js` rummer 11 mod 11,
  seedet tilfældighed, 30 faste simulationstrin i sekundet, beslutninger,
  faser, boldens 3D-position, kampstatistik og handlinger under kampen.
- `src/loop.js` holder kampens step adskilt fra requestAnimationFrame og
  interpolerer tidligere og aktuelle positioner. `src/pitch.js` tegner
  en 2D-taktisk bane på canvas med cachet græs, linjer, spillere og bold.
- `src/arena.js` tegner samme Motor 12-kamp i WebGL med genbrug af de
  licenserede lokale spiller- og målmandsmodeller fra `match-assets55`.
  Arena 3D indlæses efter brugerens valg. TV-vinkel, nærkamera, udvidet bane
  og 2D kan skiftes i samme kamp. Ved WebGL-fejl vises den taktiske bane.
- `src/club.js` gemmer lokale klubdata, aktive kampe og præferencer i skema
  1. Kampens indtægt afregnes én gang, og form og kondition følger spillerne.
- `src/app.js` binder visningerne Forside, Kamp, Taktik, Trup og Klubstatus
  sammen. `src/audio.js` spiller valgfrie dommersignaler ved brugerhandlinger
  og kampbegivenheder.
- `build.mjs` bygger fem statiske sider uden et browserrammeværk.
  `assets/ui.css` indeholder de fælles designprincipper.
  Support, privatliv og kontosletning fører videre til de officielle
  produktionssider, når en eksisterende Touchline-konto skal håndteres.
  Klubhus og web bruger nu lys papirbaggrund, rød accent og Barlow Condensed.
  Kampskærmen har en mørk scoretavle over banen og analyse under banen.

Kampen starter i PRE_KICKOFF med bolden på midterpletten. Nyt afspark efter
et mål eller i anden halvleg kræver samme aktive valg i KICKOFF_READY.
Kampuret bevarer aktuel tid ved de senere genstarter. 1×, 2× og 4× ændrer
antal simulationstrin, som bliver afviklet pr. reelt sekund.

Udkastet kan fungere som statisk webside og pakkes i Android-testskallen.
Pakken har ingen serverkonto, synkronisering eller vandring af gamle
Motor 11-klubber. Sky-backend, direkte styring af spillere, komplet regelsæt og
fysisk FPS-måling er særskilt arbejde. Offentlig produktion og den aftalte
lancering **1. januar 2027 kl. 10.00 i København** er uden for dette build.
