# Simulation choices and runtime optimization — internal code16

Public version remains1.0.0. Launch remains1January2027 at10:00Europe/Copenhagen. This is an implemented and automatically checked update, not full launch/device approval.

## Match choices

A shared MatchModeChoices component presents simulation first as a large explicit choice alongside personal3D control in clubhouse, league/team card, domestic cup, Europe and personal career. Club simulation lasts36seconds, personal simulation45seconds;3D arcade is labelled5-a-side/60seconds. Completed simulations explicitly offer to simulate the next match. Starting another personally controlled game is disabled while one is active, but simulation remains available. Callback tests invoke actual view handlers and verify the expected server paths/durations.

## Runtime and usability

- One visible-only scheduler replaces overlapping10-second/2-second polls. GETs share one in-flight request; synchronous write locking prevents rapid double taps before React disables buttons. Starting a write invalidates obsolete reads, including stale401/network-error callbacks. Account reset prevents old completions from unlocking new operations.
- Hidden pages stop polling/UI ticks. Visible idle club updates use1-second ticks; simulated matches use500ms ticks. Root ticks are suspended while controlling a manual match; its monotone local timer continues independently. Repeated connection errors do not repeatedly reopen the same toast.
- Three.js initialization is deferred until a playable match opens. Automatic graphics requests low-power rendering without antialiasing and caps pixel ratio; sharp graphics remain selectable. Pointer movement updates the joystick thumb directly without rerendering the dialog. Completed matches stop animation/HUD/storage loops; resizing redraws the final state once. Temporary camera vectors and money formatters are reused.
- Camera/quality choices persist with validated defaults even if storage access fails. Cleared match recordings cannot be recreated by cleanup. Keyboard gameplay shortcuts leave interactive controls/selects alone, and opposing movement keys correctly cancel. Simulated match dialogs lock background scrolling.
- Sidebar scrolling works on short windows; mobile bottom spacing, touch targets, focus rings, long names and career text sizes have been improved. Existing dark green/lime identity, original slogan and private support email remain unchanged.

## Verification

262 full-suite checks and3web-draft checks passed. Tests cover request coalescing and stale-response/write races, actual simulation/manual callbacks, input preferences, recording cleanup, final-frame resize, existing economy/competition/career/API/auth and January gates. Build and targeted release metadata/native-package checks pass. APKcode16 is signed with the existing certificate; packaged HTML matches native source exactly. APK and unsigned private AAB were rebuilt. No GooglePlay release.

Logs:outputs/optimization-tests.log, optimization-web-tests.log, optimization-release-check.log and optimization-launch-gates.log. Real-device touch/WebGL/performance, full browser interaction and new genuine gameplay screenshots are still unverified. Managed CUA tooling is unavailable, so no unsupported browser workaround was used. Existing email-delivery setup limitations are unchanged. Do not interpret automated checks as universal device compatibility.

Final candidate bytes:3551778; SHA256:80fd1faee272dca2ff2d86b95ce72dba873f772a90a71452ea428f723fc87d2d; certificateSHA256:968e6554f40e6cdc7e134c731c3ec42402c3fb9181f3e015b614da7d81d0204b. Native HTML equality was checked again after keyboard pitch-focus polish.
