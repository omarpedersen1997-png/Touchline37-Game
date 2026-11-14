# Touchline — Football Idle

Danish football club idle game. React interface, Cloudflare Worker API, email/password accounts and per-user D1 saves.

## Develop and verify

- `npm install`
- `npm run build` builds the native game separately from the public marketing/support client inside `dist/server/index.js`.
- `npm test` builds and runs game and API checks. No credentials or live records are used.

Game identity comes exclusively from an opaque session cookie. ChatGPT identity headers are ignored. POSTs require a matching Origin. The hosting audience is separate: owner-private Sites still have a platform login gate until the owner explicitly enables public access. Club mutations use D1 compare-and-swap versioning and idempotency IDs. Income uses server time with an eight-hour cap. Matches last 36 seconds and persist through disconnection. Future goals are hidden until their event time.

The `DB` D1 binding and `drizzle/0000_clubs.sql` are required. Sites applies migrations during publication. The SQL table is never created in request handlers.

The private deployment is controlled through `.openai/hosting.json`. Do not commit build output or credentials. The Sites starter and helper scripts were not mounted in the execution environment; this project uses an esbuild Worker entrypoint and the native Sites publication tools.

The original hosting screenshot was inspected to improve density and text size. Interactive browser QA could not run because the managed environment did not expose `cua_repl.js`. Responsive breakpoints are implemented at 370, 600, 760, 1020, 1200 and 1550 pixels; mobile and authenticated interaction checks remain outstanding.

## Gameplay update

Three saved tactics affect chance generation. Live commentary reveals only elapsed events, with an optional browser-generated goal sound and a persistent server-calculated match result. The market includes six permanent players and six seeded scout talents refreshed each season. A deterministic 11-club round robin generates all 55 fixtures with one bye per club; rival results and actual user results determine the table. Old saves and in-progress 24-second matches remain compatible. Ratings cap at 99, and fully trained teams cannot purchase ineffective training.

The balance test runs 8,000 seeded matches across initial, stronger, defensive and attacking teams. Upgrade growth is 1.6 for stadium, 1.48 for training and 1.65 for sponsorship; loss and draw rewards preserve forward progress. No database schema migration is required.

## E-mail accounts

- Apply `drizzle/0001_email_auth.sql`; configure `AUTH_PEPPER` as a Sites secret before deploying. Never regenerate or rotate it without a password migration/reset plan.
- Passwords (12–128 characters) are HMAC-peppered and PBKDF2-SHA256 hashed with 100,000 iterations and a unique 256-bit salt. The iteration count matches the Cloudflare WebCrypto limit. There are no plaintext passwords or browser-stored bearer credentials.
- Random 256-bit session tokens are SHA-256 hashed in D1. The `__Host-touchline` cookie is HttpOnly, Secure, SameSite=Lax, scoped to `/`, and expires after 30 days. Logout revokes the current session; recovery revokes every session through credential versioning.
- Registration returns a single-use 192-bit recovery code once. The UI requires acknowledging that it was saved, with local copy/download options. Password recovery rotates that code. No email delivery or email ownership verification is configured. Do not auto-link future provider identities by unverified e-mail address.
- Login/recovery and registration are throttled using atomic D1 counters scoped to trusted client IP and normalized email. Successful session creation bounds cleanup of expired sessions/counters.
- Existing ChatGPT clubs are untouched but not attached to the new account namespace (`email_...`). New email accounts start fresh, as requested.
- Auth and game integration tests run real SQLite migrations and SQL, not a hand-written SQL mock.

## Android app and additional game features

`capacitor.config.json` and `android/` contain a real Capacitor Android application with packaged React assets. `npm run android:sync` refreshes packaged code. See `release/GOOGLE-PLAY.md` for builds, upload signing, release blockers and store requirements. Backend changes must be deployed before the new Android API bridge can be used.

Game additions include six persistent milestone rewards, two UTC daily goals, a guided first-manager plan, connection/retry feedback, and password-confirmed account deletion. Mission rewards are server-validated and persisted with the existing club CAS mechanism; no new database migration is needed. Public `/privacy` and `/delete-account` routes explain data handling and deletion. The approved publisher is OPNext Games with public support at https://touchline-idle-club.glowingconch1.chatgpt.site/contact. These details are shown in the app and privacy pages; Play Console account configuration and trademark clearance are separate.

## Current launch baseline

Public site is a marketing/support site, not a playable web app. `/assets/stadium.png` is promotional artwork; phone previews are explicitly labelled illustrations. Android uses local game assets and the same HTTPS backend. Contact submissions are private D1 tickets, not delivered email. See `release/GOOGLE-PLAY.md` for operations and release limitations. The launch test includes 100 careers × 100 matches in addition to the 8,000-match balance sample.

## Unpublished web game

`npm run web:draft` prepares the browser game separately in ignored `web-draft/`, and `npm run web:test` verifies browser account flows and the production boundary. Standard production builds still have no `/play` route or game HTML. The owner explicitly requires keeping web gameplay offline until final release. Do not deploy the draft or enable a production game route without that instruction. See `release/WEB-LAUNCH.md`.

## 1.0.4 account and tycoon features

Players can be sold for server-calculated value; each sale replaces a starter with a strength-35 academy player, preserving positions and eleven players. Academy players have no resale value. Stadium art changes at levels 3, 6 and 10. Password changes rotate credentials and recovery codes; verified email changes, email verification and password reset are implemented but unavailable until a server mail provider is configured. Support forwarding is optional and preserves tickets on delivery failure. Apply migration 0003 before the new backend. See release/MAIL-SETUP.md. No web gameplay has been enabled publicly.

Latest behavior: personal recovery codes are removed per owner request. Registration and password changes have no code-save step; the legacy recovery API returns 410. Email reset requires mail-provider activation. Migrations 0003 and 0004 preserve existing accounts and clubs.

## 1.1.0 club management

Management rules live in worker/management.js. Starting XI stays in players; up to seven reserves are stored separately. Formation and match changes are server-validated, individual development is capped by potential, academy courses use server time, and fan/ticket/staff finances are part of saved club state. League and cup settlement share match presentation but have separate competition accounting. Old active games retain their original reward and duration. See release/CHANGELOG-1.1.0.md for rules and device QA.

## 1.2.0 presentation and discovery

ArenaScene.jsx projects a small 3D stadium model to SVG with three camera controls, stage-based seating/roof/lights and an illustrative match team. The model is memoized and honors reduced motion. ClubJourney selects the next actionable milestone, surfaces available daily rewards and shares public club text via the platform share sheet. Seven new server-validated milestones extend the six starting goals. Native navigation now uses four primary destinations plus More, and a resumable live-match dock. Authentication presents email before password, and registration/change/reset require 8–128 characters. No new runtime service, tracking or native permissions. See release/CHANGELOG-1.2.0.md.

## 2.0.0 club universe

worker/expansion.js implements three DNA identities, six sequential branch research projects and four repeatable board contracts. Points accrue exactly once per completed match; two starting points are lazy defaults with no historical backfill. Contract metrics snapshot cumulative career counters at acceptance and claims have per-type cooldowns. Commerce research adds to pre-wage gross, development discounts after coach effects, and academy effects apply only to future programs. worker/clubstyle.js validates cosmetic enums and bounded plain-text motto; public defaults are pure.

ClubCenter hosts ExpansionCenter and ClubStudio with separate CSS files concatenated by build.mjs into native and local web-draft assets only. ClubBadge/KitPreview and shirt patterns/arena accents use the persisted palette. Additional test suites cover migration, price/point validation, clocks, reward idempotency, simultaneous SQLite writes, club isolation and rendered controls. Browser/game remains unpublished at /play.

## 2.0 marketing refresh

The public showcase uses static SVG illustrations generated from app components, not a web-game bundle or device screenshots. To regenerate: bundle scripts/site-art.jsx with esbuild to ignored outputs/site-art.mjs and run it from the repository root. Commit assets/site/{arena-2,kit-2,badge-2}.svg. build.mjs embeds these static assets in generated-site-art.js for exact GET/HEAD asset routes; script execution is prohibited by their response CSP. The website retains coming-soon status for Play/web. Public APK and handoff archive routes are disabled; release files are retained locally for development only.
