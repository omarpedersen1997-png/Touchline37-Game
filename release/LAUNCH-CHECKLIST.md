# Touchline — vej til Google Play

Klargjort: OPNext Games-branding, dansk Idle Tycoon-butikstekst, ikon, feature graphic, privatliv, ekstern anmodning om sletning, in-app sletning, e-mail-login, kontoindstillinger, låst HTTPS API, Keystore-session, offline indtjening, mål/karriere, private supporttickets og testdownload.

## Før intern Play-test

- [ ] Ejeren har oprettet/verificeret Play Console-konto og valgt korrekt kontotype.
- [ ] Pakkenavnet `dk.touchline.footballidle` og spilnavnet er endeligt accepteret før første upload.
- [ ] Ejerens uploadnøgle og backup er oprettet sikkert; signeret AAB bygget, Play App Signing valgt.
- [ ] Den nye APK er installeret som opdatering og brugerens visuelle CSS-fejl er bekræftet væk på en fysisk telefon.
- [ ] Login, force-close, kampresume, netværkstab, mål, transfer, sæson og kontosletning testet på telefon; se DEVICE-CHECKLIST.md.
- [ ] Separat reviewer-konto oprettet, og adgang oplyst privat til Google.
- [ ] Ægte skærmbilleder af kluboverblik, hold, udvikling, kamp og mål optaget på telefon. Ingen personlige mailadresser i billederne.

## Før offentlig udgivelse

- [ ] Ejer har valgt målgruppe, lande og IARC-indholdsvurdering i Play Console.
- [ ] Data safety gennemgået mod hostingvilkår, faktiske supportprocesser og aktuelle Play-spørgsmål.
- [ ] Privatlivsteksten er gennemgået med korrekt dataansvarlig, behandlingsgrundlag og den faktiske retention. Kontaktformularen indeholder ikke juridisk ejeradresse; ejeren skal afklare nødvendige virksomheds-/personoplysninger.
- [ ] Der er en navngiven ansvarlig, der tjekker private supporttickets dagligt. Formularen videresender IKKE til Gmail endnu. Brug Sites' private databasevisning; tilslut mailleverandør, hvis automatisk levering ønskes.
- [ ] En verificeret rutine for eksterne sletningsanmodninger er på plads; kontoejerskab kontrolleres, adgangskoder/gendannelseskoder indsamles aldrig i support.
- [ ] Mailbekræftelse, nulstillingsmail og verificeret skift af mailadresse aktiveret via opsætningen i MAIL-SETUP.md, hvis de ønskes ved lancering. Personlige gendannelseskoder er fjernet; uden mailaktivering er nulstilling utilgængelig.
- [ ] Appnavn/domæne/logo er kontrolleret for rettigheder. Domæneregistrering alene giver ikke varemærkeret.
- [ ] Play pre-launch report uden kritiske fejl; Android 7–16, store skrifter, TalkBack, systemnavigation og 16 KB kompatibilitet vurderet.
- [ ] Eventuelt krav om mindst 12 testere i 14 sammenhængende dage er opfyldt via Play Console, og produktionsadgang er godkendt.
- [ ] Hostingkapacitet, kvoter og omkostninger er afklaret for forventet antal spillere; 10 sekunders polling giver backendtrafik, også uden nye handlinger.
- [ ] Backup/restore og incidentsupport er afklaret. Aktiv-database-sletning er testet; leverandørbackupretention er ikke verificeret af appen.
- [ ] Ingen nye builds frigivet uden stigende versionCode. Hver Play-version bygges fra en kendt commit.

## Drift efter launch

Kontrollér fejlrapporter, support, tilgængelighed og Play-vitals; ret kritiske fejl før større rollout. Lav ikke påstande om installationsantal, Google-godkendelse eller uafhængig test, som ikke er dokumenteret. Automatisk backup/overvågning, maillevering og verifikation er endnu ikke konfigureret.

## Aftalt direkte lancering 1. januar 2027

- [x] Første offentlige version1.0.0 med stigende intern code14.
- [x] Tidsgrænse1.januar2027 kl.10CET og serverstyret nedtælling.
- [x] APK og /play forbliver lukkede inden grænsen; gamle test/ZIP-adresser lukkes permanent.
- [x] SideloadAPK med debugging slået fra og samme eksisterende certifikat.
- [x] Browser/navigation/samme konto og offlinefejl dækket af automatiske kontroller.
- [ ] Sidste manuelle browsergennemgang og ejerens Android-opdateringsprøve.
- [ ] Mailleverandør til nulstilling/videresendelse (login viser aktuelt utilgængelig status).

Denne aftale erstatter ikke de separate fremtidige Google Play-krav ovenfor.
