# Match Pro — Android build25

The owner approved and locked the code24 app/website design. This update changes only playable matches, their engine, controls, camera and result verification. The76-file design/asset hash snapshot is unchanged; App.jsx only changes its manual protocol opt-in and publisher.js only increments the build number. Public version remains1.0.0.

## Implemented

- Default TV Pro lens: fixed screen-relative heading, predictive focus, smooth camera movement, adaptive framing/FOV for portrait, landscape and long passes. Follow, broadcast and whole-field alternatives remain available. The camera choice migrates once and then respects the owner's choice.
- Eleven-a-side deterministic engine3 with32 movement directions, three analog speed levels and20Hz input recording. Acceleration, braking, turning and player separation replace instant directional motion.
- Hold/release A for shot power; tap A without possession to tackle or dive as keeper. Hold/release B for lofted passing; ordinary short presses pass or switch/call. C remains held sprint. Charge display and assisted pass preview show the planned action.
- Passing assistance penalizes blocked lanes, attackers make supporting runs and timed tackles have an immediate chance to win possession. Sideline exits award throw-ins; last touch distinguishes corners and goal kicks. Restarts use a short dead-ball pause and normal arcade controls; full offside/foul rules are not simulated.
- Frame-time-based visual smoothing, articulated movement, short render prediction, player selection, goal celebration poses and safe-area-aware match overlays. Simple graphics retains the same controls and canonical results.
- Version3's1200 uint16 samples encode to3200 base64 characters, inside the existing4096-character API limit. Server-issued seeds/configuration remain authoritative. Claimed score/rewards cannot change replay results. Version1/2 engines and recordings remain supported; the new app requests version3 for new games. An older APK cannot submit a version3 recording successfully; install build25 before continuing such a match.
- Local saved recordings are versioned, absent time records neutral controls, final upload clears recordings permanently, duplicate finishes pay once, and personal position/progress stays separate from the club.

## Verification

-305 tests passed in the complete suite; two additional long-pass framing/tackle tests passed in the final14-test modern engine suite (307 unique automated checks total). Three web-draft checks passed.
- Targeted legacy11-a-side, camera/geometry and simple-canvas lifecycle tests passed after the final camera changes. Source diff and76-file locked design manifest checked.
- APK, exact native HTML, SHA256, Android package code25, signing certificate, private HTTPS download and real60-second server replay probes are recorded in outputs. Release check keeps the public APK and /play closed until January1 2027 at10:00 Danish time.

## Remaining verification

The managed environment has no supported browser-control tool or cua_repl.js, so no new browser/physical-device screenshots or visual/FPS approval are claimed. Test build25 on a real Android phone: both orientations, sustained play, multitouch joystick+A/B/C, charge cancellation, camera framing at boundaries, thermal/frame behavior, graphics fallback, reconnect/reopen and finish saving. This remains an arcade football game; this update does not claim a FIFA-equivalent engine or full football rules.
