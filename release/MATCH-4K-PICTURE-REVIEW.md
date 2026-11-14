# Android build26 — photographed match defects and4K rendering

The owner locked the approved menu/site design and requested a substantial match-only upgrade,4K rendering, all12 screenshots checked, with FC Mobile as a quality reference. A larger APK is authorized. This update does not claim FC Mobile production quality or verified physical-phone FPS.

## Screenshot review

All supplied images are576×1280. Their file size/resolution does not establish the3D framebuffer resolution. Observations below distinguish defects from scrolled or historical state.

| Image | Observation | Action |
| --- | --- | --- |
|1000013392|Club journey/research/economy/navigation; no demonstrated rendering defect.|Approved layout retained.|
|1000013391|Season migration warning explicitly explains the old18-point/10-game rules.|Kept; current seasons must not be retroactively rewritten.|
|1000013390|Club stadium is visibly cropped; SVG enlargement/height rules conflict with the short card.|Fit SVG to the existing card; preserve card dimensions, color, controls and typography.|
|1000013389|Career, Europe qualification and cup shortcuts are readable.|Approved layout retained.|
|1000013388|Club match actions and identity are readable; strength98 and low league position alone do not prove a calculation defect.|Approved layout and saved state retained.|
|1000013387|Navigation sheet is legible and exit visible.|Retained.|
|1000013386|Talent DNA and10% academy summary agree.|Retained.|
|1000013385|DNA purchase badges and descriptions are legible.|Retained.|
|1000013384|Active DNA state is visible.|Retained.|
|1000013383|Empty season archive in season2 may reflect a legacy save; earlier seasons cannot be reconstructed reliably from an image.|No invented/backfilled history; requires saved-state evidence to classify as a bug.|
|1000013394|TV camera can place the selected player at the right edge; control captions are small; large persistent hints cover play.|Adaptive framing for TV as well as Pro, legible captions, shorter/fading guidance and cleaner HUD.|
|1000013393|Near-camera number plaque is oversized; ball resembles a wire cage; several bodies crowd the ball; models have oversized heads and synchronized movement.|Screen-scaled number marker, smooth procedural football, revised body spacing/pressing, adult head proportions, grounded boots and independent gait phases.|

## Implementation

- Real4K option:3840-pixel long framebuffer edge, preserving viewport aspect. A16:9 landscape view produces3840×2160; the supplied tall phone aspect produces approximately1728×3840. Hardware framebuffer/viewport limits are respected. Displayed dimensions come from the actual WebGL drawing buffer; lower hardware limits are labelled rather than claiming4K. The physical screen resolution is unchanged.
- Auto quality targets a60Hz drawing cadence and reduces render scale under sustained frame pressure. Explicit4K keeps its requested resolution. Quality-specific shadows, antialiasing, anisotropic grass filtering and tone mapping improve rendering. Actual phone FPS/thermal/power costs are not measured here.
- Animated player parts are GPU-instanced while keeping per-player articulated transforms and independent jersey-number textures. A representative22-player scene reduces eligible mesh submissions from528 to64 (88%); this is a submission-count result, not an88% FPS claim.
- New original black/white panel ball, rounded spectators, smaller constant-screen-size selection plaque, smaller pointer, better proportions, independently paced running, shot follow-through and feet placed at grass height.
- Club stripe/hoop choice now appears on match kits. Orange home kits receive a blue opponent to avoid a color clash.
- TV/Pro fit player and ball; a final visibility guard prevents smoothing/switching from losing the selected player. Match HUD, score, quality controls, radar, readable A/B/C labels and safe-area padding are refined. D/Q adds an energy-limited, five-second-cooldown ball skill in new v4 games.
- Four-pass player separation and single primary presser reduce swarming. These physics live in version4; version1/2/3 engines are unchanged. Server-issued version controls codec/replay and reward validation. Older in-progress matches keep their original physics. The default client requests4 only for new games.
- Context loss and failed3D creation switch visibly to simple graphics. Scene disposal releases generated geometry/maps, observers, instanced resources and the WebGL context; no repeated passing-line buffer allocation.

## Verification and limits

321 complete automated checks and3 web-draft checks passed. Tests cover4K dimensions/hardware limits/preferences, TV framing, rounded ball geometry, batching transforms, v1/v2/v3 compatibility, v4 determinism/skill/spacing/session recovery, canonical API results and duplicate rewards. Final targeted match UI checks also passed after fallback handling. APK/release metadata, native asset equality, signing certificate and HTTPS gates are checked in outputs.

The managed environment has no supported browser-control tool or cua_repl.js. The supplied phone screenshots document the previous build; they are not evidence that build26 visually passes. Real-phone review of4K, multitouch, animation, frame stability and thermal behavior remains outstanding. No Google Play readiness or FC Mobile equivalence is claimed.

Public APK and web game stay closed until January1 2027 at10:00 Danish time. The owner receives an expiring APK link; it is not a public launch.
