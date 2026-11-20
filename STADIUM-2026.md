# TEST47 — Touchline Stadium

Brugeren bestilte en gennemgribende visuel ombygning af app og hjemmeside. Denne udgave fortsætter TEST46 og bevarer data, spilfunktioner og kampmotorer.

## Ny appstruktur

- `GameNavigation.jsx` erstatter den viste sidebar/bundnavigation med en vandret hovedmenu: Spil, Hold, Kampe, Klubcenter og Mere. Egen saldo/konto, karrieresaldo og gemmestatus bruger fortsat de eksisterende callbacks.
- `GameLobby.jsx` erstatter den tidligere kampfane og spiluniversfane med én startmenu: næste kamp, spillerkarriere, Europa og pokal er synlige samtidig. Fem genveje åbner hold, transfers, stadion, fans og rejse. Der er ingen dekorativ aktiv 3D-scene i lobbyen.
- Klubområderne beholder deres paneler. Fokus flyttes ved områdeskift, og Androids Tilbage-knap vender tilbage til lobbyen fra et klubområde, før appen kan lukkes.
- Login har en ny, illustreret flade ved siden af formularen. Det eksisterende loginflow, kontooprettelsesregler, fejl og inputfelter er bevaret.
- `stadium-console.css` definerer fælles ramme, DM Sans-overskrifter, blå overflader, navigation, hold, transfers, karriere, klubcenter, formularer og dialoger. Kampens scoreboard får et lyst broadcastudtryk med limeur; fysik, kamera og inputprotokol er uændret.
- Tidligere console/compact/refined-temafiler er ikke længere med i appens normale og native stylesheetliste. De historiske filer bevares. WorkspaceDeck bruges stadig til opgaveinddeling og bevarer formulartilstand.

## Hjemmeside

Introduktion, original stadionillustration, tre indgange og udgivelseslinje har ny komposition. Tre sider og seks slides bevares, så siden ikke bliver en lang indholdsliste. Logo, farveidentitet og citatet "Små begyndelser. Store spiloplevelser." bevares. Hjemmesidens tidligere temalag er erstattet af stadium-site.css i buildlisten.

## Kunst og kontrol

StadiumIllustration er ny original SVG, ikke et skærmbillede af gameplayet. Den bruger statiske vektorformer, klippereferencer og ingen eksterne billedkilder. Illustrationen er kontrolleret som selvstændig SVG med lokal rasterisering. Dette er ikke en browser- eller telefonkontrol af hele brugerfladen. Der findes ingen nye verificerede 4K-optagelser af appen.

688 apptests og 83 websitetests består. Efter forenkling af vektorflader er lobby-/SVG-testene og hjemmesidens UI-tests genkørt. De nye tests dækker hovednavigation, konto/saldo, kampcallbacks, menuindgange, karrierestatus, genoptagelse og SVG-referencer. De eksisterende tests bevares.

Fysisk Android-installation, FPS, varme og touch er ikke verificeret. Understøttet browserstyring er ikke tilgængelig i sessionen; layoutets fulde visuelle kvalitet er derfor ikke godkendt. Små højder og længere lister kan stadig rulle i den aktive opgave.

## Beskyttet

Motor 1–10, original motor 11, TEST45-optimeringer, gemte kampe, APK 37 og tidligere test-APK'er bevares. Testserver version 6 og produktionsdata ændres ikke. Ingen udgivelse til playtouchline.dk eller merge til hovedbrancherne på GitHub. Kun den eksisterende ejerprivate websitepreview opdateres.
