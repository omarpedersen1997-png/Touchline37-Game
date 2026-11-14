# Major update checkpoint — 11 November 2026

This is an in-progress engineering checkpoint, not launch approval.

## Published and verified

Both Android APK download and browser play are server-locked until **1 January 2027 at 10:00 Europe/Copenhagen** (`2027-01-01T09:00:00.000Z`). Marketing countdown and FAQ use the same schedule. Latest published commit: `76570806e74082c87b9de5a1218622cf4c13b3a5` (saved Sites version24), deployed after the owner explicitly approved server activation. No Google Play release.

## Activated for owner APK testing; device workflows remain under review

- Per-season competition rules, stronger higher leagues, 18–22 point targets and facility licences. Existing ongoing seasons retain old rules. Top-flight championship, title reward and bounded season archive.
- Aurora Europa Cup: earned qualification, group stage, knockout stages, fictional opponents and trophy records. Separate from domestic league/cup progression.
- Optional player career: own attributes, training, matches, XP, contracts and separate career wallet. Existing club and roster remain intact.
- Clubhouse mode entrances and premium app styling in `refresh.css`.
- Public version remains 1.0.0; internal Android versionCode is 13. A code13 candidate has built successfully at outputs/android/Touchline-code13-candidate.apk, with the same signing certificate and exact packaged native HTML. The local release artifact and current.json now point to the exact code13 candidate with its checked SHA256; full device workflows are not approved yet. The owner has supplied a real Android screenshot showing the code13 login email step rendering with the new design. The previous code12 APK is retained privately in outputs/android/Touchline-1.0.0-code12.apk.

Source implementation checkpoint `65317daca2d2074706702a57880a5411e333defc` and website/candidate checkpoint `5219c0f26beee04ab7ac3c621ec9fd3ffdfc6c83` were pushed as source checkpoints. On 11 November the owner explicitly approved activation of the new server functions after reviewing the production risk. Version24 is now deployed, including the marketing refresh, while the January APK/play gates remain closed.

## Remaining before completion

1. Completed integrated UI/website refresh and all automated tests; preserve these checks after any fixes. New tests are included in npm test. ClubHub fixture mismatch fixed. Website semantic assertions updated. All195 full-suite tests and3 web-draft tests now pass (198 total), plus release metadata/signature/packaged-native checks.
2. Rebuild/sync native assets, signed sideload APK and private unsigned AAB; retain the existing signing certificate and approved hash checks. Do not publish an obsolete APK alongside new server rules.
3. Run actual Android UI checks and capture genuine high-resolution single-viewport images. Android15 emulator is installed/rootable and both APKs install. Code12 WebView renderer crashed (code5). Code13 actual capture shows Android System UI ANR. Host has no KVM; software emulation is severely slow. Lower-resolution fallback720x1560 also produces a blank/black frame. No useful native UI capture or device approval exists. Owner-supplied single-viewport Android screenshot 1000013351.jpg now confirms real-device startup and rendering of the new login email step. This does not verify successful login, saves or gameplay. No new gameplay screenshots yet.
4. Replace low-resolution gallery images only after useful real captures exist. Do not relabel generated promotions as actual screenshots.
5. Verify web draft/API, upgrade persistence, timers, concurrent requests, hidden future results, launch gates, marketing routes and payload size. Browser UI automation remains unavailable without the managed CUA tool; do not improvise browser-control paths.
6. Owner-approved server/website activation completed as deployment appgdep_6af4c31359fc8191a7c622316414d432. Public audience and January schedule preserved; HTTP checks confirm both release routes remain404 and anonymous game requests401. Continue real-device gameplay checks and replacement screenshots before full release sign-off.

## Operational limitations

Email delivery/reset and automatic support forwarding remain unconfigured. One real-device login-render screenshot has been reviewed. No real-device test matrix or full interactive browser QA has been completed. Automated test passes do not establish universal device compatibility. Work does not automatically resume after a usage limit; resume in the same conversation from this checkpoint.

Preserve unrelated `release/ONE-CLUB-ONE-DREAM-REVIEW.md`, existing signing files and user clubs.

## Second player-career iteration — code14

Detailed acceptance checks are in CAREER-DEPTH-CHECKLIST.md. Code14 adds consequential match plans, live personal highlights, energy/recovery, coach trust and persistent form, position-specific seasonal objectives, contract roles and two additional performance-gated clubs. Personal headers/navigation now use personal money and season. Legacy careers keep their earlier energy-free rules until activated by the new client; no player or club progress is reset.

The APK/AAB were rebuilt using the existing signing identity. Local approved-artifact metadata now names code14. All217 full-suite tests and3 isolated web-draft tests passed; package/hash/native-HTML and January boundary checks also passed. Real-device interaction, updated gameplay screenshots and broad device/browser QA are still incomplete. This is a deeper implemented slice, not a statement that the full requested overhaul is finished.

## Optional playable3D iteration — code15

See MANUAL-MATCH-PROGRESS.md for the concrete implementation and limits. Real Three.js5-a-side arcade control is available as an explicit alternative to the existing11-a-side simulation in league, cup, Europe and individual player career. Joystick/keyboard movement, pass/switch/call, shot/tackle/keeper dive, sprint, camera/quality controls, fallback graphics and deterministic server replay are implemented.244 full-suite checks plus3web checks pass. Candidate15 is signed with the existing certificate and has exact source/native HTML. Device touch/WebGL/performance review and new screenshots are still outstanding; do not call the full overhaul launch-approved.

Code14 production activation succeeded as saved Sites version27/deploymentappgdep_6af4d4700a148191aef2fd916fbdd513. Its live45-second career test passed, including salary-once, plan, hidden future result, manager isolation and deletion of the temporary test account. Code15 backend/website activation succeeded in saved Sites version28. Both real60-second manual API workflows passed, including deterministic score/contribution validation, early-finish rejection, one-time rewards, manager isolation and deletion of the temporary test account. Final dialog/palette corrections are included in the rebuilt candidate. The January1 release time and public route gates are unchanged.

## Simulation choice and optimization — code16

See OPTIMIZATION-CHECKPOINT.md. Simulation is now the first explicit large choice beside3D control throughout all competition and career entry points. App polling/request locks, deferred graphics startup, completed-scene cleanup, persisted display settings, keyboard interaction, navigation and mobile readability have been improved.262 full-suite checks and3web checks passed. A new candidate16APK/AAB was built with the existing signing identity and exact packaged HTML. Real-device performance and full interactive browser QA remain outstanding; public January launch gates are preserved.

## Full layout redesign — code17

See REDESIGN-CHECKPOINT.md. Shared app chrome, compact clubhome, reorganized team/career, email-first login/forms and a coherent visual system cover all screens. Website now matches and preserves launch/countdown/legal routes.265 app checks plus3web checks passed. Actual device/browser visual review and fresh screenshots remain outstanding; older real captures are explicitly labelled. PublicJanuary gates are unchanged.

## Football Matchday identity — code18

See FOOTBALL-DESIGN-CHECKPOINT.md. User rejected the dark palette; app and website now use light club-paper and grass-green layouts. Club home is rebuilt as a crest banner, fixture ticket and homeground; website hero uses clearly-labelled new football illustration. Both match modes and all stored game progress are retained.265 app checks and3web checks pass; phone visual approval and new captures remain outstanding. January launch gates unchanged.

## Return to the requested deep-green identity — code19

See GREEN-CLUB-CHECKPOINT.md. The light paper/ticket direction was rejected. It has been removed from the active build in favor of deep forest green, original lime actions, integrated stadium/fixture layout and matching website.265app checks and3web checks passed. Existing functions/saves and January release gates remain unchanged. Visual device approval is still outstanding.

## Active code20 — green stadium and direct football control

GREEN-CLUB-CHECKPOINT.md supersedes earlier design and5-a-side descriptions for current clients. Deep-green presentation, rebuilt stadium geometry,11v11 direct-control games, broadcast camera, correctly mapped joystick, radar and personal-position control are implemented.273 full-suite and3 web checks passed, signed sideload APK and unsigned AAB built, matching native HTML/certificate verified. Older challenge replay remains compatible. Public access stays January1 2027 at10CET. Physical phone touch/WebGL/performance approval remains required; no claim of full release readiness.

## Active code23 — original slate background, football game menu and immersive match controls

FOOTBALL-CONSOLE-UPDATE.md supersedes the code22 green-page direction. The owner requested inspiration from mobile football game references and restored the original dark blue-grey background. New player-led mode cards, real cup/career/Europe destinations, full-pitch A/B/C controls, close camera, articulated players and matching website are implemented.278 full tests plus3 web checks passed. Native build/packaging records are in the current checkpoint. Physical Android visual/touch/performance verification is still outstanding; no public game/APK opening before January1 2027 at10CET.

## Active code24 — squad portraits, scout controls and player-career navigation

PLAYER-CARDS-UPDATE.md continues the code23 reference-inspired game interface. Real eleven-player lineup cards, position/price/strength/budget filtering, clear signing conditions and portrait-led career profile/navigation are implemented. Original blue-grey background, code23's full-viewport A/B/C matches and own artwork are retained.283 full-suite plus3 web checks passed. Physical phone rendering/touch/performance approval remains outstanding; the public January1 opening is unchanged.

## Active code25 — locked design, upgraded playable matches

MATCH-PRO-UPDATE.md supersedes earlier match-engine descriptions for new clients. The code24 app/website design is explicitly locked. Only match gameplay changes: TV Pro adaptive camera, analog32-direction movement with acceleration, shot/loft charge controls, passing lanes, supporting runs, player separation, tackles and dead-ball restarts. Deterministic20Hz v3 replay keeps older engines intact.307 distinct automated checks plus3 web checks passed. Public January1 opening remains closed; physical Android touch/render/performance approval is still outstanding.

## Active code26 — screenshot-driven match and4K update

MATCH-4K-PICTURE-REVIEW.md records the12-image audit, actual4K option, GPU-instanced animated players, natural panel ball, TV framing, readable match controls and new v4 spacing/skill controls. Original v1/v2/v3 replay physics are preserved. The approved menu/site design remains locked; only the club stadium's SVG fit is corrected outside matches.321 full checks and3 web checks passed. Physical Android4K/visual/FPS validation remains outstanding, and FC Mobile equivalence is not claimed. January1 launch gates remain closed.

## Active code27 — landscape, human rig and professional match presentation

PRO-MATCH-UPDATE.md describes the new native landscape/immersive lifecycle, reference-led wide TV HUD, real rigged adult asset and human locomotion, new stadium and engine5 through balls/keeper dynamics. Menus/site presentation are retained. APK distribution moves to private R2 to support growth without embedding binary bytes in Worker code.347 full checks plus3 web checks passed. Real Android orientation/touch/render/FPS review remains outstanding; asset preview is explicitly separate from gameplay. Public January1 gates are unchanged.
