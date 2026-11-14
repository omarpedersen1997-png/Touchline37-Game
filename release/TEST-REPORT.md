# Launch verification — 1.0.1

Automated checks: 43 tests pass (8 game, 4 HTTP API, 13 authentication, 10 progression, 8 launch/support). Tests exercise actual SQLite migrations, queries and transactions. No production users or credentials are used.

Simulation coverage: 8,000 seeded balance matches and 10,000 matches across 100 persistent simulated careers. Checked result accounting, 1,000 season transitions, bounded ratings, finances, 11 unique shirt numbers, match settlement, concealed future results and bounded history. These are simulations, not 18,000 human/device play sessions.

Other coverage: registration, password hashing, normalized email, login/logout, expired sessions, recovery and code rotation, cross-account isolation, deletion, atomic duplicate purchases, offline cap, transfer validation, training caps, tactics, full round robin, missions/daily rollover, malformed JSON, contact persistence/consent/rate limiting, receipt, old support cleanup, marketing/native bundle separation and PNG artwork bytes.

Build verification: locally packaged Capacitor Android assets; compile/target SDK 36, minimum 24; debug APK and release AAB build. Release bundle has no production upload signature. The debug APK is for testing only.

Limitations: no managed browser QA tool was available. No device was connected. Emulator installation failed for lack of disk space while extracting Google's system image; temporary downloads were removed. Native UI, keyboard, TalkBack, font scaling, navigation/back, process recreation, network reconnection and the new document picker still require actual-device testing. No genuine device screenshots were captured. Website imagery is labelled promotional illustration/design preview.

Release blockers: owner's Play account verification and signing; internal device test and Play pre-launch report; real screenshots; audience/content rating/data safety/reviewer access declarations; required closed test if applicable; operational support inbox and email delivery if desired. External account-deletion requests require an ownership verification procedure. No claim of production launch or Google approval.

## 1.0.2 visual regression fix

A real user screenshot exposed missing inherited text colors and CSS variables in the Android login. The font-import stripping expression stopped at a semicolon inside the Google Fonts URL and invalidated the subsequent :root selector. Removal now consumes the complete import. A regression check verifies the packaged CSS begins with a valid root theme after bundled font faces, without an external font URL, and contains both text and lime colors. All 45 automated checks pass. Android APK/AAB rebuilt as versionCode 3; no physical-device visual verification performed in this environment.

## 1.0.3 release preparation

45 automated tests pass, including the existing native-theme regression and stricter multi-@ contact-address rejection. Build/asset checks verify version metadata, icon/feature-graphic dimensions, store title/short-description lengths, native/local settings, and exclusion of the support email and playable game from the public bundle. Error boundaries provide retry/support fallback instead of a blank view; expired mutation sessions return to login. Signing configuration now rejects partially supplied upload-key variables. All required dependency and font notices are bundled. The new UI behaviors still require device verification.

## 1.0.4 tycoon and account update

59 standard automated tests plus 3 browser-draft tests pass. New coverage checks sale values/academy replacements, impossible resale loops, match locks, concurrent sale idempotency, stadium thresholds, password changes/session and recovery rotation, disabled mail handling, hashed single-use tokens, email changes, expiry, reset privacy and reuse, recipient limits, provider errors, and durable support tickets during mail failure. Mail tests replace fetch with a simulated provider; no real mails are sent. No new device or browser UI session was available.

Latest 1.0.4 steering: personal recovery-code generation, UI, file export and API redemption removed. Registration/password changes return only the user/session; legacy codes are invalidated without deleting accounts or sessions. Tests now validate this behavior. The mail-reset tests confirm a single-use emailed code changes the password without issuing a permanent code. Android lint succeeded with warnings for template resources, icons, Gradle currency and synchronous preference persistence; no errors. Backup/transfer exclusions were subsequently made explicit.

## 1.1.0 management verification

77 standard automated tests plus 3 web-draft tests pass. Sixteen new management tests cover legacy normalization, four formations, goalkeeper constraints, bench capacity and sales, individual training/potential, coach effects and wages, timed academy/graduate idempotency, full benches, ticket/capacity math, supporter changes/campaign cooldown, cup eligibility/accounting/trophies/penalties/season reset and concurrent SQLite API requests. Two server-rendering tests check management views on legacy state and academy/cup result states; these are rendering checks, not browser interaction tests.

Additional simulation: 20 careers × 20 seasons = 4,000 league and 630 cup matches. In combination with the existing 8,000 balance and 10,000 long-career matches, 22,630 simulated matches run through test loops (plus focused cases). Accounts and saved club JSON are preserved. No live user accounts are modified by tests. Real Android UI and interactive browser QA remain outstanding.

## 1.2.0 arena, navigation and login

82 standard automated checks plus 3 web-draft checks pass (85 total). New coverage checks exact eight-character registration/login/password changes, rejects seven-character passwords, and exercises eight-character email reset using a fake mail provider. Mail is not configured in production. Four server-rendering checks cover club management, arena geometry at four stages, the email-only initial login screen and manager journey. Two mission tests cover all seven new milestones, legacy claims, progress limits and idempotent claims. Existing match simulations remain 22,630 matches.

The arena projects 3D world coordinates into SVG, sorts solid faces by depth, and uses memoization to avoid rebuilding unchanged geometry on the game clock. There is no WebGL or new native dependency. Its start/final SVG stages were rasterized and visually inspected with librsvg; this verifies arena artwork only. Full native layout, camera touch interaction, two-step login/autofill, mobile menu/back, font scaling and keyboard still need physical-device verification. No browser/device interaction test is claimed.

The APK and unsigned AAB were built for version 1.2.0 (7). APK embedded HTML was compared byte-for-byte to current local native assets. Existing test signing identity is retained. Web game remains an unpublished local draft.

## 1.2.1 typography

Small app labels now have a 10 px floor; labels up to 10 px gain 2 px and 11–12 px text gains 1 px. Large headings retain their sizes. Summary/transfer labels may wrap to avoid crowding on narrow devices. Android assets rebuilt; release metadata and existing rendering/launch checks rerun. Physical-device typography verification is still required.

## 1.3.0 modern clubhouse

84 standard automated checks plus 3 web-draft checks (87 total). The suite includes two new server-rendering checks for the new clubhouse: idle/live primary action, three destinations, actual club metrics, ready academy indicator and unique player-art resource ids. Existing six management rendering checks cover arena stages, login and goals as well. Game/auth/data rules are unchanged; existing balance and career simulations remain in the suite.

The clubhouse now places the projected 3D arena, actual metrics and play/watch action first, followed by quick destinations and the manager journey. Fans/finances are in native HTML details/summary. Full squad is available under Hold. New art uses inline SVG and no external image/font service. Arena geometry uses a mild perspective projection, a second camera elevation, paths, trees and roof ribs. Reduced-motion support is retained.

Arena artwork was rasterized with librsvg for inspection. This is not a browser or device screenshot. No managed browser tool or physical phone is available, so visual layout, keyboard, accessibility and interaction tests on Android are still required. Debug APK and unsigned AAB target 1.3.0 / versionCode 9; embedded native HTML is verified against built assets before packaging.

## 2.0.0 club universe

110 standard automated tests plus 3 local web-draft checks pass (113 total). New suites: five clubstyle validation/isolation tests, twelve expansion tests, three integrated SQLite/API tests, four expansion rendering tests and two integrated UI checks. Existing game, auth, management, progression and balance tests remain. The expansion simulation adds 100 matches with all six research nodes; total seeded match simulation coverage is 22,730. These are machine simulations and server-render checks, not human/device sessions.

Coverage includes old saves gaining exactly two research points with no retroactive match awards, preserved claims and rosters, one-point-per-settlement including cups, three DNA effects, bounded research bonuses, prerequisites, server price/clock checks, locked simultaneous research, once-only completions, career-delta contract metrics, cooldowns, season carry, no future-match leak, parallel persistence of clubstyle plus DNA and account isolation. Seven/eight-character password boundaries remain in the suite.

Native APK and unsigned AAB target version 2.0.0 / versionCode 10. Embedded APK HTML is checked against current native assets, signature verified, public release ZIP scanned for private support address and final compressed Worker size checked against 10 MiB. New module CSS is asserted present in native assets. No new permissions, external services, tracking or analytics. Mail provider remains unconfigured.

Club kit/badge vectors are generated from validated enums with unique SVG ids. No managed browser automation tool or physical device is present. Full keyboard/TalkBack, touch, screen sizing, local draft preservation and new flow interaction verification remain manual Android release tasks. Public /play stays 404.

## 2.0.1 Android screenshot findings

User-supplied real Android screenshots confirm rendering of the 2.0 hub, squad, league, match dialog, DNA cards and club studio. They reveal a floating live dock overlapping mid-page content, excessive repeated mobile summaries on Center/Team, and a dark chosen formation label caused by a legacy color rule combined with the new dark background. Disabled DNA/formation during an active match is intended behavior. Screenshots do not verify interaction, persistence or full release QA.

Fixes move the live control into a single sticky header stack in normal flow; remove the obsolete floating dock; hide duplicate Center/Team summaries and introductions on mobile; shorten the kit preview; and restore light selected-formation text. A rendering check covers the live control's score/opponent name, modal focus exclusion and empty state. The updated build still requires physical-device verification. Public APK/ZIP routes remain disabled.

## Follow-up: real disk restart flows

116 standard automated tests plus3 local web-draft checks now pass (119 total). Three new Worker/API integration scenarios use an actual SQLite file, nine database close/reopen cycles and fresh Worker imports. A controlled clock avoids waiting for wall time. The scenarios verify locked DNA during a match followed by selection after settlement, preserved research deadlines and once-only3% bonus activation, and saved club color/pattern/crest/motto surviving restarts without stale retries overwriting newer data. Other accounts remain isolated. No product defect found. These tests verify server/database restart, not physical Android force-close or tap automation.

Four1024×1536 RGB PNG Google Play promotional phone images are prepared from supplied screenshots. They are not raw screenshots, are not published to Play or the website, and do not imply launch readiness. Mail delivery is still unconfigured.

## First public1.0: Friday APK and browser opening

136 standard automated checks plus 3 web-draft checks pass (139 total). Confirmed opening:13November2026 at10:00 Europe/Copenhagen (09:00UTC). Tests cover exactly before/at/after the server boundary, client clock/query/header bypass attempts, clean APKfilename and hash, retired download/ZIP URLs, GET/HEAD/method/cache behavior, metadata failure and shared browser/native cookies. Five countdown/recovery rendering checks and ten navigation checks (five per web/native compilation) were added.

Public versionName1.0.0 with versionCode12 preserves upgrade ordering from private2.x builds. SideloadAPK has no debuggable flag, allowBackup=false and cleartext=false, retains the approved existing certificate, and matches the final native HTML. Build-time hash validation pins the approved release artifact. No production Play upload/signing is claimed.

Interactive browser QA remains unavailable because the managed desktop js tool is not offered. Browser tests here mean HTTP/API/cookie integration and server-rendered React checks, not clicks in Chrome. The pre-existing physical Android screenshots remain applicable visual evidence for shared components. Mail provider remains unconfigured and the UI labels reset as unavailable. See PUBLIC-LAUNCH.md.
