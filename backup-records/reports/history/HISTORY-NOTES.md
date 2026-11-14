# Historik og kontrol af hemmelige oplysninger

Dette er en skrivebeskyttet gennemgang af det tilgængelige originale Git-projekt. Der er ikke udført checkout, reset, clean, gc, fetch, push eller ændringer af originalfiler. Kun rapporter under sikkerhedskopieringsmappen er oprettet.

## Tilgængelig historik

- Baseline: `c71fbb7b617e95f23c737dc5a9fc7fc0a206430e`.
- 67 lokale commits; repositoriet er ikke en shallow-kopi.
- Referencer: `refs/heads/main`, `refs/heads/feature/manual-play-3d` og `refs/remotes/origin/main`.
- 1.867 reachable Git-objekter: 67 commits, 577 trees og 1.223 blobs.
- Den eksisterende origin bruger HTTPS på `git.chatgpt-team.site`. Der findes ingen indlejret bruger/adgangskode i remote-URL'en. Det er ChatGPT Sites' kilderepository, ikke et allerede oprettet GitHub-repository.

Et `git bundle` med de tilgængelige referencer kan bevare denne historik uden at kopiere `.git/config`, credentialhjælpere, reflogs eller maskinens øvrige Git-konfiguration. Et separat nyt GitHub-repository bør have frisk lokal historik og ingen forbindelse til det aktive Sites-repository.

## Kontrolresultat

1.754 tekstdokumenter og 122.973.357 tekstbytes blev gennemgået, herunder commitmetadata og læsbare tekstressourcer i 54 historiske ZIP/APK-containere. Der er søgt efter private PEM-nøgler, almindelige GitHub/OpenAI/AWS/Google/Slack-credentialmønstre, rå private downloadtokens, Bearer-litteraler og miljøvariabler med konkrete hemmelige værdier. Arkivernes filnavne er desuden kontrolleret for keystores, JKS/P12/PFX, `.env`, keystore-properties og Google-services-konfiguration.

- Ingen bekræftede hemmelige credentials, private nøgler eller rå downloadtokens fundet.
- Ingen private nøgle-/keystorefilnavne fundet i Git eller arkiverne.
- Ingen mistænkelige konkrete miljøvariabelværdier fundet.
- 672 AWS-lignende delstrenge forekom i 42 tekstobjekter. Samtlige blev kontekstuelt verificeret som delstrenge helt inde i indlejrede base64-data-URL'er fra eksempelvis fonts og modeller. De er ikke adgangsnøglelitteraler. Rapporten gemmer kun filnavne, objekt-id'er og antal, aldrig fundne værdier.

Den eksisterende ikke-versionerede brugerfil `release/ONE-CLUB-ONE-DREAM-REVIEW.md` og de tre lokale draftfiler `release/source-export.json`, `tests/source-download.test.mjs` og `worker/source-download.js` er også kontrolleret uden credentialfund. De er ikke udgivet i baseline og bør bevares tydeligt adskilt som ikke-udgivet arbejde. Export-JSON indeholder en tokenhash, ikke det rå adgangstoken.

## Begrænsninger

Mønsterscanning kan ikke bevise, at alle tænkelige former for hemmelige oplysninger er fraværende. Binær APK/AAB-bytecode er ikke reverse-engineeret. Tekstressourcer og arkivmedlemmers navne er kontrolleret. Eksterne kontodata, databaser og miljøhemmeligheder er ikke en del af Git-historikken og er ikke sikkerhedskopieret af denne gennemgang. Originale signeringsnøgler skal fortsat håndteres særskilt og må ikke lægges i disse repositories.

Der blev ikke fundet grund til at filtrere den tilgængelige commit-historik. En historikbundle skal stadig have checksum og verificeres efter oprettelse; rapporten beviser ikke i sig selv, at en senere bundle blev oprettet eller testet korrekt.

Maskinlæsbare detaljer findes i `inventory.json` og `unpublished-audit.json`. Rapporterne indeholder ikke hemmelige matchværdier.
