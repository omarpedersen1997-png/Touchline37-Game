# Android test before Play rollout

Install the debug APK on a test phone (Android 7+). Use a new test account, not a personal account. Do not publish the debug APK as a production release.

- Create account, confirm immediate access with no personal recovery-code step.
- Login after force-close; logout; wrong password; reset via email after provider activation; old sessions must fail.
- Rename club; inspect all six tabs; buy a player; upgrade all buildings; change tactics.
- Start match, close match view, background/force-close and relaunch; result and reward should settle once.
- Disconnect/reconnect: display retry, retain account and saved club, no duplicate debit when retrying a purchase.
- Return after idle: income up to eight hours, no repeat credit on refresh.
- Play a season, inspect standings and promotion; claim mission once; inspect career counters.
- Open help/privacy/contact; submit a marked test message; save receipt; return with Android Back.
- Try keyboard, large fonts, small display, portrait/landscape, screen reader, gesture navigation and system bars.
- Delete test account with password + SLET; relaunch; login and old personal recovery-code route must fail.

Run Play internal testing and pre-launch report on the owner's signed AAB. Capture genuine screenshots for the store listing only after UI testing.

## 1.1.0 management scenarios

- Change all four formations, verify pitch positions, choose a substitute, and try to move a goalkeeper into an outfield slot (must be denied).
- Buy a player, confirm the replaced player is on the bench; sell a reserve and a starter, checking distinct effects.
- Train starter/reserve individually; check exact debit and potential cap.
- Start academy course, background/relaunch after completion, claim once, and test a full bench without losing the prospect.
- Hire each staff type; check wage/net-income breakdown and offline income; max level 5.
- Change ticket prices and confirm attendance/net previews; change during match must be denied. Run campaign once, check one-hour cooldown.
- Play 2 league games, complete cup rounds, check penalties and trophy. Cup games must not change league points or played count. Cup resets with league season; staff, youth and fans persist.
- Verify new sections with Android keyboard, screen reader, large font size and smallest supported phone display.

## 1.2.0 final visual and interaction checks

- Log in: email → Continue → password. Correct email with Ret; Android Back returns to email. Verify keyboard/autofill and failure retries.
- Create an account with exactly 8 characters; reject 7. Check password change and (once mail is configured) reset too. Existing accounts remain usable.
- Rotate stadium left/right and reset, at all four development stages; ensure no clipping at 320/360 px, large fonts and landscape.
- Open match illustration; check 22 players, result, close, next match and reduced-motion behavior. Illustration does not reproduce the goal event engine's exact player positions.
- Use all five bottom tabs, More → Transfers/Goals/Help/Club; check focus, Android Back, safe area and keyboard.
- Resume an active match using the floating live button. Check it does not obscure navigation or dialogs.
- Check all 13 milestones, one-time rewards, daily reward shortcut and existing claims after update.
- Share club text through Android share sheet; cancel cleanly and verify private email/account identifiers are excluded.

## 1.3.0 clubhouse

- At 320/360/412 px, large fonts and landscape: inspect hero title, capacity, camera buttons, three metrics and play/watch action. No clipped text or overlapping controls.
- Rotate the stadium and switch Overblik/Tribune at all four stages. Check roof and projectors fit.
- Start a match directly from the clubhouse, close it, then resume with Se live. Check button loading and offline errors.
- Open all three shortcuts (Hold, Transfers, Akademi); return using the bottom menu/Android Back.
- Expand Fans & økonomi; operate ticket selector and fan campaign. Confirm collapsed content is skipped by TalkBack.
- Open Alle mål & karriere, claim a reward and confirm the manager journey advances.
- Check transfer player figures, rating labels, prices and actions at both mobile column widths.
- Existing accounts and clubs must survive installation over 1.2.1.

## 2.0.0 club universe

- Install above 1.3.0 and verify account, name, bank, roster, career and claimed goals persist. Initial research points2; no historical backfill.
- Center is a primary bottom item; upgrades remain under More and the academy shortcut. Check all destinations and Android Back.
- Select each DNA on test clubs, verify free initial choice, later1500kr confirmation, match lock and described bonuses.
- Start/complete research with insufficient/adequate points and money; close app during timer, return and activate once. Check all three branch locks and discounts.
- Accept each contract; historical results must not count. Complete/claim once, verify one-hour same-type cooldown and other contracts available.
- Change shirt color/pattern, badge shape and motto; explicitly save and verify in hub, squad, transfer art, stadium and match. Polling must not erase unsaved studio drafts; two devices must reflect saved changes.
- Check 320/360/412px, large font, TalkBack labels, keyboard tab arrows/Home/End, contrast, focus and no horizontal scroll.
- Verify mail features remain clearly unavailable until provider configured; no personal recovery code reappears.

## 2.0.1 screenshot regression checks

- Start a match, close dialog and scroll through Hold/Center: live control must remain below topbar, with no floating strip over text, forms or bottom navigation.
- Inspect all four formations before/during a match: selected label must be readable. Match locks remain intentional.
- Open Center and Hold on360px/large fonts: functions appear earlier; club overview and redundant introductions are removed on mobile only.
- Open clubdesign: preview remains legible and save controls reachable. Confirm all changes still persist.
- Read active match dialog with TalkBack/keyboard: background live control is excluded from focus while dialog is open.

## Code20: direct-control stadium acceptance

- Install code20 over the existing APK and verify the same club and email account remain.
- Play one11v11 game in each camera. Broadcast joystick must follow the screen, with home attacking right; other cameras and simple graphics attack up.
- Check all22 players, articulated running, complete goals/nets, crowd, roof supports and camera clipping at both goals.
- Confirm player marker, radar, possession, pass/switch, shot/tackle and held sprint work with two simultaneous fingers.
- Test portrait/landscape on a small phone. Pitch and controls should be visible together, without the system gesture bar covering the controls.
- Test WebGL context loss/simple fallback, background/reopen and final score submission. Run several matches for frame stability, heat and battery.
- Confirm a game begun by an older APK can still finish after server/client upgrade, and simulation remains selectable.
- Capture genuine normal-height screenshots only after physical-device approval. Current marketing stadium art is an illustration.

## Code23: football menu and immersive controls

- Confirm login/account shows1.0.0 (23), original blue-grey page background, and the new player-led clubhouse.
- Test both landscape and portrait menus: manual/simulation, live resume, career, Europe, Sæsonpokalen, team, transfers, academy and stadium upgrade destinations.
- Rotate during a live match. The pitch should fill the window, score remain legible, exit remain reachable, and joystick/A/B/C avoid the system gesture areas.
- Hold joystick and C simultaneously; release outside the circle. A/B should register once per press. Keyboard/focus loss must not leave sprint held.
- Close camera should show the controlled player at all pitch edges; test TV/whole-field, quality change and simple fallback. Camera selection is disabled when simple rendering is active.
- Check kit numbers, articulated running, contact shadows, grass and crowd for clipping, sustained frame stability and temperature. Test context loss, reopen and canonical score save.
- No device screenshots have been produced for this build. Capture genuine normal-height images after these checks; marketing character art is explicitly an illustration.

## Code24: squad, scout and career navigation

- Confirm1.0.0 (24). Check each of the six portrait cells for correct cropping on both a narrow phone and landscape.
- Filter transfers by all four positions, sort strength/price, toggle budget-only, and reset an empty result. Price, signing conditions and actual server purchase must agree.
- Open all eleven lineup players. Recruit must open transfers; Trup & reserver must open and focus the tactical workspace. Active-match controls must remain locked.
- Check personal career profile, XP, own wallet and salary. Sticky links must reach the actual match/training/contract sections without covering their headings.
- Retest code23's landscape touch controls, close-camera selection and field visibility. Avatar/menu improvements do not constitute physical-device match approval.

## Code25: TV Pro and modern match engine

- Install1.0.0 (25) over the existing app. Existing clubs, menu design and website presentation should remain as approved.
- Start a new manual club match and personal match. TV Pro should be the first camera; rotate both ways. Verify fixed rightward attack, readable scoreboard and reachable exit. Long passes must pull the camera out and then return closer.
- Slowly move the joystick, reverse direction and sprint; assess acceleration and touch response. Hold A with possession, release to shoot; cancel the touch and confirm no unwanted shot. Hold B to loft and check the dotted assisted-target line. Tap B to pass/switch/call; tap A to tackle/dive.
- Score and concede; check goal feedback, keeper responses and reset. Send the ball over sidelines/bylines and check throw-in/corner/goal-kick possession and short pause.
- Use multiple fingers, release outside buttons, open help, background/reopen, change graphics and force context loss. No button should remain held. Check60-second completion, reconnect/retry and exactly one saved result/reward.
- Reopen an older v1/v2 match and verify its original controls/replay still finish. Do not continue a v3 match from an older installed APK; update that device first.
- Physical-device visual quality, sustained FPS and thermal/battery behavior remain unverified by automated tests.

## Code26:4K, instancing and photographed defects

- Confirm1.0.0 (26); install over the existing signed build and retain account/club. Menu and website layout should be unchanged. The club stadium must fit fully inside its existing card.
- Start a NEW manual match for v4. Check four A/B/C/D actions, readable captions, compact scoreboard/radar, TV/Pro visibility at pitch edges and on switching players. Near-camera number marker should remain compact.
- Choose Grafik →4K · Ultra. Read the actual buffer dimensions; long edge should be3840 when hardware supports it. Rotate landscape/portrait. Test Auto under pressure, sharp, simple, and repeated quality changes; watch for context loss, stuck controls or growing GPU memory.
- Judge the new ball panels, foot grounding, head proportions, running phases, kit stripe/hoop choice, spectators and shadows. Confirm orange home kits receive contrasting opponents.
- Hold joystick+C and release A/B to shoot/pass; cancel pointer capture, background/reopen, keyboard focus and network reconnect. D/Q should perform a short skill only with possession, cost energy, and cool down for five seconds.
- Check player collisions and pressure without swarming; personal position remains locked. Test canonical finish/retry once, both personal and club modes.
- Record real FPS, temperature and battery use in4K over several complete matches on the owner's phone and a lower-powered Android. No automated CPU test certifies those outcomes.

## Code27: landscape professional matches

- Install1.0.0 (27) over the previous signed build. Start a NEW manual match for engine5/human players; older in-progress recordings retain their previous engine/rendering.
- Native phone should rotate to landscape even with portrait system rotation preference; system bars hide during the match and show by edge swipe. Exit/back/background/return must restore/reapply the appropriate orientation, bars and awake state. Menus retain their prior orientation.
- Check human face/hands/kit/boots, natural run cycle, kicks/tackles/keeper dives, new pitch/stadium, contact shadows and skinned number/selection readability in Auto/Sharp/4K. Review heat, memory and sustained FPS; real-device values are not established by CPU tests.
- Shoot/pass/through/sprint are word-led colored controls. Test joystick plus sprint plus release-to-shoot/pass, R-through, Q-skill, selection switching and cooldowns. Settings/help/portrait/background must clear held input; no invisible controls should accept touches.
- Portrait guard must block gameplay input if orientation cannot lock, clearly stating the already-started server clock continues. Settings/help/back/focus exits remain reachable.
- Verify club and personal canonical finishes, reconnect/retry, payout once and previous1–4 compatibility. Verify private APK range downloads and public release paths remain closed until January1.
