# Aktivering af mail — Resend-adapter klargjort

Mail er IKKE aktiveret i produktion. Der er ingen API-nøgle eller verificeret afsender tilgængelig i projektet. Tests anvender en simuleret transport og sender ingen rigtige mails.

## Ejerens opsætning

1. Opret eller brug en Resend-konto. Bekræft et afsenderdomæne, fx `mail.playtouchline.dk`, efter Resends konkrete DNS-anvisninger. Tilføj kun de DNS-poster, tjenesten viser; de eksisterende A/TXT-poster til hjemmesiden skal bevares. Et registreret domæne alene giver ikke ret til at sende via en mailudbyder.
2. Opret en API-nøgle med mindst mulig adgang til mailafsendelse. Del den ikke i chat, kode eller dokumenter.
3. Indtast disse serverværdier som hemmeligheder i Sites-projektets indstillinger:
   - `MAIL_API_KEY`: Resend API-nøglen.
   - `MAIL_FROM`: en bekræftet afsender, fx `Touchline <noreply@mail.playtouchline.dk>`.
   - `SUPPORT_TO`: den private modtageradresse, som ejeren allerede har valgt til support. Den skal ikke stå i klientkode.
4. Kontrollér afsendelsesgrænser, spam/DKIM/SPF og udbyderens behandling af persondata. Udvid privatliv/datasikkerhedserklæringer før aktivering.
5. Test med en særskilt testkonto: GET /api/auth/capabilities skal angive emailDelivery=true; anmod om mailbekræftelse, skift mail og nulstil adgangskode. Bekræft reel modtagelse, spammappe og udløb. Test også en markeret supportsag.

## Implementeret adfærd

- Request-verification sender engangskode til den aktuelle adresse. Change-email kræver den nuværende adgangskode og sender kode til den nye adresse; nuværende adresse ændres først ved korrekt kode.
- Mailkoder har 192 bits tilfældighed, hashes på serveren og udløber efter 30 minutter. En kode kan bruges én gang og er bundet til kontoens credential-version. Koder sendes aldrig tilbage til klienten i API-svaret.
- Request-reset giver samme bekræftelse for eksisterende og ukendte adresser ved normal levering. Reset-password kræver kode, e-mail og ny adgangskode. Andre sessions og eksisterende mailkoder tilbagekaldes; brugeren logges ind med det samme uden ekstra gemmetrin.
- Selvbetjent skift af adgangskode kræver nuværende adgangskode og virker uden mailudbyder.
- Maillevering benytter HTTPS POST til Resend og idempotensnøgle. Providernøglen og supportmodtageren leveres aldrig til appen eller hjemmesiden.
- Support gemmes først som privat ticket. Med mail konfigureret forsøges videresendelse. Feltet delivery_status angiver stored/delivered/failed. En providerfejl fjerner ikke henvendelsen. Der er ikke en automatisk retry-jobkø; sager med failed skal gennemgås manuelt.
- Personlige gendannelseskoder er fjernet. Uden mailkonfiguration giver mailnulstilling en tydelig fejl om manglende aktivering, og mailændringer markeres som utilgængelige i kontoindstillingerne. Der er ikke en alternativ kode, brugeren skal gemme.

## Før aktivering

Reel maillevering, leverandørkonto, domæneverifikation og privatlivsopdatering er stadig udestående. Resend kan behandle modtageradresse, mailindhold og leveringsdata. Oplys ikke, at tjenesten er forbundet, før en rigtig testmail er modtaget. Ingen mail er sendt af implementeringsarbejdet.

Officiel dokumentation: https://resend.com/docs/api-reference/emails/send-email og https://resend.com/docs/dashboard/domains/introduction .
