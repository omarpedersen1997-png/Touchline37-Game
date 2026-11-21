# TEST53 – størrelsespolitik og mere levende kamppræsentation

Udgangspunkt: TEST52 (`72fbda57909b147cbfdcd4ca86837daf8487e836`). Separat udviklingsbranch; ingen merge eller deployment. Motor 11 R3's autoritative fysik, servervalidering, inputs og uploadformat ændres ikke.

## 1. Faktiske størrelses- og budgetgrænser

| Område | Før TEST53 | Efter TEST53 |
| --- | --- | --- |
| Hele APK-filen | Ingen hård 5 MB-test fundet. TEST52 fylder allerede 5.084.449 bytes. Cirka 5 MB var en målsætning i opgavebeskrivelser, ikke en platformgrænse. | Eksplicit **intet hårdt APK-loft**. Fra 25 MiB gives en størrelsesadvarsel med gennemgang af download/opstart; ingen testfejl alene på grund af APK-størrelse. |
| Samlet Android-JavaScript | `tests/native-performance-assets.test.mjs`: hårdt loft på 2.500.000 ukomprimerede bytes. | Intet hårdt total-loft; fra 4 MiB gives en advarsel om lazy loading og parsning. |
| JavaScript ved opstart | 1.200.000 ukomprimerede bytes; Three.js, modeller og bevægelsesdata må ikke ligge i login-grafen. | Bevares som reel opstartsbeskyttelse. Mere kampkode/ressourcer kan indlæses lokalt ved kampstart. |
| Komprimeret Worker/server | Advarsel 9.000.000 bytes, testfejl 9.400.000 bytes. Dokumenteret 10 MiB er **ikke bekræftet** som faktisk hostinggrænse. Release-check har separat 10 MiB-kontrol. | Bevares. Større APK/ressourcer må ikke ukritisk indlejres i den allerede store Worker. Ingen hostingændring gennemføres. |
| Serverkomponenters vækst | Mere end 5 % komprimeret vækst kræver bevidst opdatering af `tests/bundle-baseline.json`. | Bevares som gennemgang af serverpakken; **5 % er ikke 5 MB** og gælder ikke APK'ens samlede størrelse. |
| Android-rendering | Motor 11 Auto højst ca. 1,2 mio. renderpixels, DPR op til 1,25, adaptiv nedskalering; skygge-/detaljevalg pr. grafiktilstand. | Bevares: flere bytes på disk er ikke mere GPU-kapacitet. |
| Brugerdata/JSON-eksport | 1 MiB-grænser beskytter API og fil-eksport; optagelser og backup valideres. | Bevares. Det er sikkerheds-/datagrænser, ikke et ressourceloft for appen. |

`dev/size-policy.mjs` samler klientens advarsler og tekniske Worker-værdier. `dev/build-performance-assets.mjs` rapporterer vurderingen; det stopper kun ved ugyldige størrelser eller overskredet opstartskode. `dev/apk-size-report.mjs <apk-fil>` måler eksisterende APK'er uden at ændre dem. Nye tests viser udtrykkeligt, at 25/80 MiB APK og 8 MB samlet JavaScript ikke i sig selv giver testfejl. Det er ikke en anbefaling om ukritisk at indlæse 8 MB ved opstart.

## 2. Konkrete forbedringer af kampen

- **Førsteberøring:** Den gamle præsentationsvagt kunne fryse boldens mellemframes i op til tre ticks efter kontakt. En allerede afgjort, ejet R3-modtagelse kan nu tegnes kontinuerligt. Uafgjorte modstanderkontakter, løse bolde, redninger og ældre motorrevisioner beholder deres konservative vagt. Ingen spiller får bolden ved en ny regel.
- **Retningsskift:** R3-kroppens retning samples mellem ticks med samme begrænsede svinghastighed som motoren. Det ekstra visuelle 18/s-filter fjernes i R3; ældre optagelsers præsentationssti bevares. Retningen glider over den korte vinkelvej og skriver aldrig i simulationen.
- **Vægt i bevægelsen:** En let, dæmpet hældning følger acceleration/opbremsning og sideværts kraft. Begge spiller-LOD'er får den samme reaktion. Fodfæstet korrigeres efter kroppens hældning, så støvlesålerne fortsat står på græsset.
- **Boldens rul:** R3-bolden roterer efter faktisk tilbagelagt afstand og en 0,22 m referenceradius. Den tidligere meget langsomme kosmetiske rotation bevares i ældre revisioner. Luftbolde har separat visuel spin; afspark/teleport, pause og baggrundsretur må ikke give et rotationsryk. Flyvebane og resultat er uændrede.
- **Kamera:** Fokus bruger den samme viste boldposition og spillerposition mellem ticks, så kameraet ikke kun modtager 20 Hz-trapper. Dæmpningen reagerer lidt hurtigere uden at skifte styreakser eller øge zoom. Riggen nulstilles nu også ved afspark efter mål/halvleg og retur fra baggrunden. Reduceret bevægelse bevares.

Der er ikke tilføjet fyld, ekstra modeller, videoer, biblioteker eller nye netværkskald for at få en større APK. Det ekstra spillerum bruges til selvstændig præsentationskode og regressionsdækning; senere større ressourcer kan vurderes uden et kunstigt 5 MB-stop. Fysikændringer kræver fortsat en ny eksplicit motorrevision.

## 3. Målinger og verificering

Den syntetiske sammenligning i `test-evidence/feel-TEST53-presentation.json` bruger den faktiske gamle og nye kamerarig samt en kontrolleret 4,5 rad/s vending. Efter et fokusstep på 10 m er resterende kameraforskel efter 200 ms cirka 5,92 m før mod 4,63 m nu. Den ekstra visuelle vinkelforsinkelse på ca. 14–16 grader i vendingseksemplet bortfalder i den nye mellemtick-sampling. Dette er **matematisk præsentationskontrol, ikke telefon-FPS eller målt fingerforsinkelse**.

Nye tests dækker størrelsespolitikken, den frosne R3-kilde, korteste drejeretning, 30/60/120 Hz-respons, rul efter afstand, kontaktvagter, kameraets reset og begge rigtige modeller med fodsåler under hældning. Hele eksisterende testsuiten, gamle motorer og optagelser køres også.

## 4. Telefonkontrol – OnePlus Nord 4

1. Installér oven på Touchline TEST uden afinstallation. Kontrollér, at klub, lyd og splashvalg er bevaret. APK 37 skal fortsat være separat.
2. Lav tre kolde starter og tre kampstarter. Bemærk tid til menuer/spilbar bane. En større download må ikke give tung login-parsning eller gentagne modeldownloads.
3. Spil mindst to fulde kampe i Auto med 60 FPS-valget; sammenlign derefter 120-valget. Hent ydelsesrapporten. Faktisk FPS, hukommelsesforbrug, varme og batteri kræver fysisk måling.
4. Modtag korte og hurtige afleveringer under pres. Bolden skal tages med glidende, men må ikke tegnes gennem en uafgjort modstanderkontakt. Selve fysikreglerne er stadig R3.
5. Dribl på tværs, accelerér, slip styrepuden og vend 90/180 grader. Mærk kropsretning og vægt; se efter fodglidning, hældning og fødder under/over græsset.
6. Følg boldens rul, skud og luftbolde. Se især efter pludselig rotation ved afspark, redning, målreplay og pause.
7. Test TV Pro/broadcast, en lang aflevering, mål og anden halvleg. Kameraet skal bevare overblik uden ekstra zoompumpning. Prøv også reduceret bevægelse.
8. Skift til en anden app i 5–10 sekunder og vend tilbage. Se efter kameraryk, forkert boldposition, tabte knaptryk og dobbelte resultatgemninger.
9. Spil 10–15 minutter: vurder varme, stabilitet og baggrundsapps, og sammenlign Auto med Skarp 3D. APK-størrelse kan ikke bruges som mål for RAM/GPU-belastning.

## Ændrede kildefiler

- `dev/size-policy.mjs`, `dev/apk-size-report.mjs`, `dev/build-performance-assets.mjs`, `dev/bundle-report.mjs`
- `dev/test-release.json`, `package.json`
- `src/ball-roll.js`, `src/match-player-pose.js`, `src/match-prediction.js`
- `src/manual-scene.js`, `src/living-camera.js`, `src/pro-player.js`, `src/player-grounding.js`
- `tests/bundle-budget.test.mjs`, `tests/native-performance-assets.test.mjs`, `tests/match-feel-headroom.test.mjs`, `tests/player-grounding.test.mjs`
- Denne dokumentation, `TEST-ANDROID.md` samt TEST53-APK, PDF og evidens.

APK 37, Motor 1–10, Motor 11 R1/R2/R3-regler, optagelser, testkonti og offentligt website bevares. Ingen produktion, testserver, database, hosting, DNS eller main ændres. Lanceringstidspunktet 1. januar 2027 kl. 10.00 dansk tid ændres ikke. Ingen garanti om 60–120 FPS eller lavere RAM/varme gives uden fysisk test.
