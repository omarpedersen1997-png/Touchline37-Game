# Modern app and matching website — code17

Public version remains1.0.0. Launch remains1January2027 at10:00Europe/Copenhagen. No GooglePlay publication or early public game/download access.

## Implemented layout

New shared app chrome groups desktop routes into club/history, uses a compact topbar and familiar five-item mobile navigation, and replaces repeated full club summaries with compact context where useful. Team layout separates lineup from tactics/squad with keyboard-operable tabs. All routes, balances, match modes and game actions remain available. A skip link leads to the main content.

Club home combines stadium and next-match choices into one matchday area with a compact metrics rail, economy and useful shortcuts. Player career has a profile/wallet grid, organized match/readiness/season overview, development groups and consistent section anchors. Login remains email-first/password-second with8-character registration minimum, in a new compact mobile layout. Account, deletion, recovery and contact screens share the same form styling.

New common ink/slate/lime design system covers squad, transfers, facilities, league/cup/Europe, clubcenter/research/DNA/studio, goals, dialogs, manual/simulated matches and navigation. Native splash/theme colors match. Earlier tablet icon-only rules, offscreen toast transforms, desktop dialog scrolling and native safe-area conflicts were corrected during independent source review.

The public website matches colors, typography, straight card frames, hero, modes, gallery and launch panels. Original motto “Små begyndelser. Store spiloplevelser.” preserved. Countdown and coming-soon behavior unchanged. Existing real screenshot assets were retained and explicitly labelled as earlier development-version captures; no fake replacement screenshots were generated.

## Verification and limits

265 full-suite app/API/interaction/SSR checks and3web-draft checks passed. Navigation tests verify every destination stays reachable, selected states, mobile More and career balance semantics. Existing simulations, personal controls, save-state, economy, authentication, mail8-character constraints and January release gates remain covered. Logs in outputs/redesign-all-tests.log and redesign-web-tests.log. Targeted app-chrome/management/career/auth/website tests also passed.

Real-device appearance, touch performance, interactive browser QA and fresh gameplay screenshots remain unverified. Managed Sites CUA tooling is unavailable; no unsupported browser-control workaround was used. This checkpoint is not full launch approval. Mail-delivery/provider setup limitations remain unchanged. Unrelated name-review file and user clubs were preserved.

Candidate17APK: 3574138bytes;SHA256:6a9cb14dae4bd04061272934d2b94e2eb565856b9770d85710c117f1ce18395c. Existing signing identity verified and packaged native HTML matches the final source build exactly. Private unsigned Play AAB built.
