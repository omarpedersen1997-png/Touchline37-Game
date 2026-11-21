# TEST54 – sammenhængende kampdag, klubbriefing og interaktiv hjemmeside

Udgangspunkt: TEST53 `336d8debb287cbb9103539713de63061d32a4701`, som bevarer TEST51/R3 og TEST52. Arbejdet ligger på separate udviklingsbranches i Game og Website. Offentlig hjemmeside v56, main, APK 37, gamle APK/PDF'er, databaser, domæne og DNS bevares.

## Konkret nyt i 3D-kampen

- **Forberedelse før første billede:** Model-/shaderforberedelsen kunne bruge flere sekunder efter første gendannelse og efterlade interaktionen bag kampuret. `finishMatchPreparation` indhenter denne tid med neutrale inputs i portioner på højst fire, med task-yield og annullering, mens indlæsningen stadig vises. Ingen ticks droppes. Det interaktive loop beholder højst fire inputs/2 ms-budget pr. billedkald. Testen giver præcis samme fulde uploadpakke og sluttilstand som neutral reference.
- **Kort boldspor:** R3 kan vise et kort, diskret spor efter hurtige frie bolde. Ét Line-draw, højst 16 genbrugte samples og ca. 120 ms historik; ingen nye objekter i hvert frame. Sporet bruger den faktisk viste boldposition, nulstilles ved kontakt/afsæt og skjules under ejerskab, målsekvens, pause og reduceret bevægelse. Det ændrer ikke boldens fysik eller kollisioner.
- **Kontaktlyd:** Seneste registrerede spark og stolpe-/overliggerkontakt kan udløse Web Audio-lyde. Der er throttling, alderskontrol og ingen afspilning af den gamle sidste handling ved åbning/retur. Mål får en kort, filtreret syntetisk publikumsreaktion. Bufferen oprettes først ved brug og genbruges; ingen lydfiler eller netværkskald.
- **Samme lydvalg:** Den eksisterende lokale lydnøgle bevares. Knappen hedder nu kamplyd, fordi den også styrer kontaktlyde. Mute, blokeret lyd, manglende API, baggrund og dispose håndteres. Eksisterende dommerfløjt og beskyttelsen mod falsk afsparksfløjt ved genåbning bevares.
- **Kamp-HUD:** Livekortet har dækkende marineblå baggrund. Boldbesiddelse vises konsekvent med én dansk decimal, også 100,0 %. Status fortæller om indhentning af kampuret ved mindst ét sekunds efterslæb og ryddes ved ændret efterslæbstilstand; den påstår ikke længere fejlagtigt, at en allerede kørende kamp genoptages. FINTE-feedback skaleres uden at overskrive knappens placeringstransform.

TEST53's glidende førsteberøring, kontinuerlige R3-kropsretning, acceleration/hældning, korrigeret fodfæste, rul og kamerafokus på den viste bold er bevaret. Auto-pixelbudget, LOD, batching, draw-call-kontrol og shaderopvarmning bevares. Fysisk 60–120 FPS er ikke verificeret.

## Analyse og sammenhæng i appen

- **Halvlegsanalyse:** Åbn en kompakt analyse i den eksisterende 10-sekunders pause og gå direkte til den eksisterende kampplan. Den viser registreret afleveringspræcision, antal spillere med lav kampenergi og op til to konkrete råd. Pause-overlayets gamle `pointer-events:none` blokerede den nye disclosure; klikområdet er nu udtrykkeligt aktivt. Åben analyse centreres, afgrænses og kan rulle på lave skærme.
- **Efterkamp:** Samme analyse følger resultat og optjente belønninger. Historiske kampe bruger deres faktiske `manualStats`, ikke en forkert alternativ stats-egenskab. Ingen ukendte tal udfyldes med fiktive værdier.
- **Kampens spiller – afgrænset grundlag:** En profil kan vælges fra begge holds registrerede mål/oplæg, vægtet 3/2; selvmål udelades. Det er mærket som målbidrag, ikke en komplet karaktermodel. Mangler individuelle bidrag, vises ingen opdigtet vinder. Hjemmeholdets navne bruges kun fra den aktuelle trup under livekamp; ukendte/historiske spillere benævnes med nummer.
- **Klubbriefing:** Et sammenfoldet felt under de seks genveje peger på faktiske klare belønninger, manglende klublicens, optjent Europaplads, eksisterende spilleraktivitet/træning og hold/taktik. Knapperne fører til eksisterende funktioner; der bygges ikke kopier af marked, træning eller turneringer.
- **Passiv indtjening:** Den eksisterende serverkvittering vises i briefingen med beløb og minutter og kan kvitteres væk. Beløbet er allerede krediteret af serveren; åbning/dobbelttryk udløser ingen ny udbetaling. Kvitteringen nulstilles ved kontoskift/logout. Ingen fremskridt flyttes til en usikker ny browser-save.
- **Seks synlige genveje:** Den sjette knap kunne lande på en klippet anden række i bredformat, fordi grid'et stadig havde fem kolonner. Bredformat bruger nu seks; portræt tre gange to.
- **Arkiverede resultater:** Browserprøven afslørede, at gamle grønne styles stadig slog igennem i resultatpanelet. Arkivvisningen bruger nu samme marineblå flader og læsbare klubkoder som resten af appen.
- **Tom managerrejse:** En tom ældre milepælsliste kunne give NaN i progressbarens bredde. Den har nu en gyldig tom tilstand og et gyldigt progress-interval.

## Hjemmesiden – kun udvikling/privat preview

- Den eksisterende korte slideside og mørke/lime-branding bevares. Kampillustrationen er nu et lille interaktivt laboratorium med kort aflevering, stikning og afslutning, tydelige situationstekster samt start, pause, fortsæt og se igen.
- Der er ingen autoplay. Én SVG-transform animeres efter brugerens tryk; siden pauser ved baggrundsskift. Reduceret bevægelse viser slutpositionen statisk. Ingen video, modeldownload eller tunge nye billeder.
- Illustrationen er tydeligt mærket som illustration og ikke et skærmbillede/live gameplay. De eksisterende 4K-ressourcer bevares; der fremstilles ingen nye testbilleder som aktuelle 4K-appoptagelser.
- Kontakt, forvalgt kontosletning, rettigheder/privatliv, metadata, favicon, dansk sprog og lanceringsgating genverificeres med de eksisterende websitetests. Lancering er fortsat **2027-01-01T09:00:00.000Z**, dvs. fredag kl. 10.00 i København.
- Privat preview er en separat statisk kopi uden spilbackend. Formularer kan vises, men previewet sender ikke support eller kontoændringer. Offentlig playtouchline.dk genudgives ikke.

## Bevarede grænser og ærlige begrænsninger

Ingen ændring i `shared/`, `worker/` eller native Android-kode. Motorer 1–10, R1/R2 og R3's serverbekræftede regler, R2-checksum og optagelser er bevaret. Ingen merge, ny serverversion, produktionsdata- eller domæneændring. Test-app-id/certifikat samt save-, lyd- og splashvalg bevares. TEST53's bløde APK-/kampkodeadvarsler består; opstart og tekniske hosting-/GPU-grænser er stadig beskyttet.

Der er ikke udviklet nye spillermodeller, komplet manager-skade-/karantænesystem eller komplette offside-/frisparks-/straffe-/kort-/indskiftningsregler. Den eksisterende energi, restitution, træning, økonomi, marked, klub-DNA, liga/pokal/Europa og progression er genbrugt. Taktik og replaytempo eksisterede allerede; det nye er analysen og sammenkoblingen. Aktiv servervalideret kamp kan fortsat ikke pauses/fremskyndes. Ved faktisk under fem FPS kan fire-inputsgrænsen stadig være langsommere end uret. Ingen garanti om stabil fysisk FPS, RAM, varme eller batteri gives.

## Fem minutter på OnePlus Nord 4

1. **0:00–0:30:** Opdater oven på Touchline TEST uden afinstallation. Åbn briefingen, kontroller seks genveje, beløb/klubnavn, notch og din bevarede lyd-/splashindstilling.
2. **0:30–2:30:** Start en kamp i Auto/60. Mærk 90/180-graders vendinger, førsteberøring, korte afleveringer, stikninger, skud og sprint. Slå kamplyd til, og prøv igen med mute. Kig efter løse boldes spor og fødder på græsset.
3. **2:30–2:40:** Åbn halvlegsanalysen, skift kampplan og kontroller anden halvlegs rolige afspark.
4. **2:40–4:40:** Test kamerafølgning, mål/net/replay hvis et mål opstår, og én kort baggrund/retur. Afslut kampen, se analysen og kontroller, at resultat/belønning gemmes én gang. Hent ydelsesrapporten.
5. **4:40–5:00:** Åbn det private websitepreview på højkant. Vælg en illustreret situation, start/pause og prøv stikning. Kontroller nedtælling og footerlinks. Prøv reduceret bevægelse senere, hvis den ikke allerede er slået til.

En længere 10–15 minutters prøve er nødvendig for meningsfuld varme-/batterivurdering. Desktop-/software-WebGL og Node-tests dokumenterer ikke OnePlus-FPS.

## Filer

Se de to udviklingsbranchers diff samt `test-evidence/matchday-TEST54-*`. Game-kilden ændrer App, GameLobby, ClubJourney, ManualMatch, MatchLivePulse, MatchSoundControl, match-sound, match-statistics, manual-scene og stadium-console.css; tilføjer ClubBriefing, MatchAnalysis, match-analysis, match-audio-feed, match-preparation og ball-trail; opdaterer testmanifest/pakke og tilføjer matchday-tests. Website ændrer MatchPreview, stadium-site.css og de relevante UI-tests. Dokumentation, APK/PDF og evidens følger denne aflevering.
