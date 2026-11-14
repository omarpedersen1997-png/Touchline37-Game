# Player career depth — internal Android code14

This is a substantial second iteration of the player mode, not approval of the whole game for public release. The public version name remains1.0.0. Android and web launch stay at 1 January2027,10:00 Europe/Copenhagen.

## Implemented

- Three match plans change team chances, personal contributions, energy use and the fit between a player's attributes and responsibilities. Goalkeepers receive appropriate plan descriptions and save behaviour.
- Matchday shows the score and genuine simulated goals, assists and saves only after their elapsed game minute. A saved match keeps its original outcome.
- Energy, passive recovery and free recovery sessions give training/match scheduling a cost. Readiness contributes to performance.
- Coach trust, persistent form over the last ten matches and three position-specific season objectives influence progression. Training does not erase match form.
- Objective rewards are idempotent. Completed unclaimed objectives pay automatically at season end. Twenty personal season summaries are retained.
- Development, starter and key-player contracts offer different pay, XP, training prices, workloads and performance expectations. Offers validate all conditions before deducting fees.
- Six fictional clubs. The final clubs require actual completed objectives, form, coach trust and winning seasons, beyond money/level counters.
- Personal navigation uses the player's money and season. The next-match action appears before deeper development panels, and jump links keep keyboard focus in the right section.

## Compatibility

Existing names, attributes, career/club money, roster, active outcomes and season progress are preserved. Older career clients keep their previous energy-free loop until a new client performs an action with journeyVersion1. This activates the advanced career permanently for that player. Use the new APK on devices used for that career after activation.

No new database tables or email delivery are introduced. All private career state remains within the authenticated club state and existing atomic version checks. No public leaderboard or multiplayer advantage is claimed.

## Required real-phone pass

1. Install code14 over the existing app, without uninstalling; sign in and verify existing club/player progress.
2. Open the personal career. Header balance and season must match the personal wallet/season, while Club shows club money.
3. Choose a plan, start a match, switch to Club and return. The match must retain its score/history and pay once after completion.
4. Complete training, allocate a point and recover; energy, coach trust, form and objective progress must be clear and consistent.
5. Claim one objective, then retry/refresh. Money/XP must be awarded once. Unclaimed completed goals must survive season rollover as automatic payments.
6. Inspect locked offers and all contract roles; an unavailable role must explain the missing requirements and never deduct money.
7. Check layout with large fonts, Android Back, keyboard and TalkBack. New images must be genuine single-viewport captures; existing low-resolution gameplay images are still pending replacement.

Passing automated source/API/SSR tests does not complete this phone checklist or the separate browser/device matrix. Mail delivery remains unconfigured. The previous APKcode13 is retained privately for evidence; the existing signing identity must be preserved.
