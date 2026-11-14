# Touchline Football Idle — Android / Google Play

Status: Android project and test build prepared. **Not submitted to Google Play.**

## Build

Requires Node 22+, JDK 21 (including javac), Android SDK 36 and build tools 36.0.0.

```sh
npm ci
npm run android:sync
cd android
./gradlew assembleDebug
./gradlew bundleRelease
```

Outputs:

- `android/app/build/outputs/apk/debug/app-debug.apk`: debug-signed test app; not a Google Play production release.
- `android/app/build/outputs/bundle/release/app-release.aab`: unsigned unless the upload-key environment variables below are set. Unsigned bundles cannot be uploaded as a release.

Use Android Studio **Build → Generate Signed App Bundle / APK → Android App Bundle** to create/use your own upload key. Store it and its passwords securely outside the repository and execution environment. Never send key passwords in chat. Alternatively set `TOUCHLINE_KEYSTORE` (absolute path), `TOUCHLINE_STORE_PASSWORD`, `TOUCHLINE_KEY_ALIAS`, `TOUCHLINE_KEY_PASSWORD` in the local build environment before `bundleRelease`. No production key has been created by this task.

## Identity and version

- Provisional application ID: `dk.touchline.footballidle`. Confirm before the first Play upload: package identity cannot be renamed for an existing listing.
- Display name: Touchline Football Idle. Developer/studio: **OPNext Games**. Google Play support email: **omarpedersen1997@gmail.com**. The app/site expose only `/contact`.
- Version: 1.0.0, versionCode 12. Increment versionCode for every subsequent upload.
- Minimum Android: 7.0 / API 24. Target/compile: Android 16 / API 36.
- User-facing capability permission: INTERNET only. AndroidX also declares an app-local signature permission for unexported receivers. No advertising ID, contacts, photos, storage or location permission is requested by this app.

## Architecture

The React interface is packaged locally with the Android app (`native-web/`, copied by Capacitor). It is not a remote `server.url` wrapper. The HTTPS API stays at `https://touchline-idle-club.glowingconch1.chatgpt.site`.

A narrow native `TouchlineApi` bridge performs only allowlisted GET/POST API requests. It does not follow redirects or accept arbitrary destinations. Session cookies stay in an AES-GCM vault backed by Android Keystore, never localStorage or JavaScript. Backup is disabled. Backend accepts the local Android origin `https://localhost`; normal web origin checks remain enforced. Standard TLS verification stays enabled.

Native back closes dialogs, returns to the club tab, or exits the app. App resume refreshes server state. Internet is required for sign-in, purchases and matches; connection failures show retry actions. Idle income is settled on the server after reconnection. Fonts are bundled, with OFL licenses in `assets/fonts`.

## Before Google Play submission

1. Confirm the legal publisher details in the owner's Play Console account. The chosen public developer name is OPNext Games and the approved Play support email is omarpedersen1997@gmail.com. The app and site show only a contact form; this address is not in either client bundle. This does not certify trademark rights or change any Play Console record.
2. Confirm the package ID, app title, countries and intended audience.
3. Create/verify the Google Play Developer account and enroll in Play App Signing. Use the owner's upload key.
4. Run real-device testing: create/login/logout/recover/delete account; app force-close/relaunch; old session expiry; connection loss; live match resume; Android Back; keyboard and edge-to-edge layouts; accessibility and font scaling.
5. Upload a **signed** AAB to internal testing and review Play's pre-launch report. The build currently contains no custom native binary libraries; review the final Play compatibility report, including 16 KB page-size support, before rollout.
6. Complete Data safety, account deletion URL, content rating, target audience, app access/reviewer credentials, ads declaration and store listing. Do not reuse a personal user's credentials as reviewer credentials.
7. For applicable new personal developer accounts, arrange the required closed test (currently at least 12 continuously opted-in testers for 14 days) and apply for production access.

The account deletion page is `/delete-account` and the privacy-information page is `/privacy` on the production domain. Both are publicly accessible; actual deletion requires account authentication, the current password and explicit confirmation. E-mail, account, all sessions and the club are removed atomically from the active database. Anonymous login counters expire separately. No e-mail provider, verification-mail delivery or reset-link delivery is configured; personal recovery codes have been removed and email reset requires provider activation.

## Store assets and text

- `store-assets/icon-512.png`: 512×512 original launcher/store icon.
- `store-assets/feature-graphic-1024x500.png`: promotional illustration, **not a gameplay screenshot**.
- Real phone/tablet screenshots are still required. Do not represent these illustrations or generated markup as screenshots.
- Short description draft: `Byg din fodboldklub, find talenter, og spil dig til toppen.`
- Full description draft: `Start med en lille klub og store ambitioner. Hent fiktive spillere, vælg din taktik, og følg automatiske kampe med livekommentarer. Udbyg stadion, træning og sponsorater, hent belønninger fra managerplanen og daglige mål, og kæmp om oprykning gennem ni liganiveauer. Klubben tjener også penge, mens du er væk, i op til otte timer. Log ind med e-mail og adgangskode, og fortsæt på flere enheder. Internetforbindelse kræves.`

Data safety draft for owner review: e-mail/account identifiers and game progress are collected for account management and app functionality; session and temporary anti-abuse data protect the service; all transport is HTTPS. No ad SDK, analytics SDK, purchases or push notifications are included. Confirm how hosting providers and their logs/backups must be declared; this document is not a completed Play Console submission.

## Policy sources (checked 2026-11-10)

- Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- New personal account testing: https://support.google.com/googleplay/android-developer/answer/14151465

A successful build is not Google Play approval and is not a device/emulator test. Interactive browser/device QA was unavailable in the execution environment.

## Contact operations

`/api/contact` stores private support tickets in D1 `support_messages` (migration 0002), with consent, honeypot, origin validation and five messages per trusted IP per 15 minutes. The visitor receives a reference, not an email delivery claim. There is no SMTP/email provider configured: the Gmail address in the Play listing does not automatically receive form submissions. The owner can inspect tickets through Sites database tools (overview, then DB/support_messages rows). Do not grant inbox access based on unverified game email. Verify account ownership through a separate trusted channel before fulfilling an external deletion request; never ask for a password/recovery code. Records older than 90 days are purged on form processing; there is no scheduled cleanup configured. Establish an inbox review/deletion routine or connect an authenticated mail service before production.

## Prepared owner handoff

`STORE-LISTING-DA.md`: ready-to-copy listing text. `PLAY-CONSOLE-ANSWERS.md`: declaration fact sheet and remaining owner decisions. `LAUNCH-CHECKLIST.md`: rollout gates. `THIRD-PARTY-NOTICES.txt`: bundled dependency/font notices. `release:check`: reproducible metadata/assets/privacy separation checks. Public marketing domain is https://playtouchline.dk; API remains on the original stable Sites origin so installed accounts continue to work.

## 1.0.4 accounts and tycoon update

Password changes are available in Login & sikkerhed, revoke other sessions without a personal recovery-code prompt. Email verification, verified email changes and email reset are implemented behind server mail capabilities, disabled until MAIL_API_KEY and MAIL_FROM are set. Support forwarding additionally needs SUPPORT_TO. See MAIL-SETUP.md. Direct player sales replace the sold player with a strength-35 academy player; academy players cannot be sold. Stadium visuals evolve at levels 3, 6 and 10.

Personal recovery codes and the file-save bridge were removed at the owner's request. Signup and password changes now proceed directly; migration 0004 invalidates legacy codes while retaining accounts, passwords and sessions. `/api/auth/recover` returns 410 for old clients. Mail reset is the only recovery flow and is unavailable until mail service activation.

## 1.0.0 management update

Four formations and manual bench changes, individual training and potential, timed academy development, fan/reputation and ticket economics, three paid staff roles and a separate three-round seasonal cup. Existing club JSON is normalized without resetting accounts/club progress. No additional database migration or Android permission. See CHANGELOG-1.0.0.md. Web gameplay remains unpublished. Download versions and filenames now come from release/downloads/current.json.

## Direkte APK og web før Google Play

Første offentlige udgave1.0.0 (code12) er planlagt til13.november2026 kl.10 dansk tid, via hjemmeside og browser. Google Play kommer senere. Se PUBLIC-LAUNCH.md. APK til sideload er signeret og ikke debuggable; Play-AAB kræver stadig ejerens uploadsignering.
