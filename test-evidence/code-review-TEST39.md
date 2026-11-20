# Kodegennemgang — TEST39, 20. november 2026

Udgangspunkt: ec21d26 på codex/motor11-performance. Ingen produktionsudgivelse.

## Kontrol og afgrænsning

- Inventar og SHA-256 for projektfiler i src, shared, worker, dev, scripts, tests og Androids main-kilde. 285 filer er registreret, heraf 251 JS/JSX/MJS-filer syntakskontrolleret med esbuild. Java/XML er registreret; Androids faktiske Gradle-build kontrollerer Java-koden.
- Målrettet manuel gennemgang af netværk/nativebro, kontoadgang, samtidige spilforespørgsler, kampoptagelse/genoptagelse, resultatkvittering, retry, databasekonkurrens, sceneindlæsning/oprydning, automatisk grafik, orientation og shaderopvarmning.
- Hele eksisterende testkæde køres inklusive motorfrysning, determinisme, gameplay, økonomi, karrierer, auth, UI og produktionsisolering.
- Ingen påstand om manuel linje-for-linje-gennemgang af samtlige filer. Afhængigheder, tredjepartskode, genererede pakker og fysisk telefonadfærd er ikke fuldstændigt revideret. En bestået testpakke beviser ikke fravær af alle fejl.

## Rettet fejl: frist stoppede ved HTTP-svarhoveder

`requestWithRetry` afventede transporten inden for fristen, men læsning/normalisering af svaret skete efter fristen eller hos kalderen. Browser-fetch afgøres ved svarhoveder, så en efterfølgende hængende eller afbrudt body kunne lade login/spil vente eller omgå retry.

Hele svarindlæsningen og normaliseringen ligger nu inden for samme forsøg og tidsfrist. Kaldere modtager et færdiglæst svar. Afbrudte spil-downloads og HTML-gatewayfejl kan gentages; login og andre følsomme handlinger gentages fortsat aldrig automatisk. 204/205/304 og headers bevares.

Seks regressionstests dækker hængende JSON/HTML, afbrudt download, normaliseret gatewayfejl, kalderabort og bodyløse svar. Ingen kampregler eller motorprotokoller ændres.

## Fortsat uverificeret eller manglende

- Fysisk Android-installation, 60 FPS, touch, varme, batteri og GPU-tid.
- Fuld browserbaseret visuel QA samt afhængigheders komplette sikkerhedsrevision.
- Offside, komplet frisparks-/kortsystem, liveudskiftninger og fuld kamplyd er fortsat manglende funktioner; de er ikke implementeret i denne fejlrettelse.

Original APK 37, TEST38, kampmotor 1–10 og original motor 11 bevares. Testmiljøets server og playtouchline.dk ændres ikke i denne gennemgang. TEST39 anvender samme isolerede server som TEST38.
