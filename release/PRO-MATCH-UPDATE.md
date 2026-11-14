# Build27 — landscape professional match rebuild

The owner supplied a wide broadcast football reference and requested a major match-only overhaul. Existing club menus, page palette and marketing presentation remain locked. FC-style camera/control composition is a reference; no EA branding, licensed clubs or extracted game assets are used.

## Delivered

- Native TouchlineMatchDisplay Capacitor plugin: sensor-landscape, immersive system bars and awake screen during manual matches; restores the previous configuration on exit/background/navigation/destroy and reapplies on resume. A portrait input guard remains for unsupported browsers/large Android windows; no claim that the running server clock is paused.
- White/black top-left scorebug and lime clock; colored translucent word-led shoot/pass/through/sprint controls at the edges; small skill control; bottom-center radar and player energy; settings/help sheets with focus management, cleared inputs and accessible exits.
- A fully clothed adult1.83m skinned player replaces procedural capsules in NEW v5 matches. The optimized GLB has real face/hands, photographic skin/eyes, football kit, slim studded boots,26 joints and approximately27k triangles. Team kit recolor/pattern, individual number and selected marker remain. Idle/walk/run/strafe/cheer tracks use baked rig animation; football kicks/tackles/dives layer over locomotion. Source and commercial redistribution notices are in assets/game/FOOTBALL-ASSET-LICENSES.md and APK assets/public/third-party/football-assets.txt.
- New two-tier stadium, rounded spectators, roof/tunnels/technical benches, original Touchline advertising boards, natural grass material and solid pitch markings. The default wide landscape camera follows the reference's pitch framing and fixed input heading.4K remains an actual framebuffer option with hardware-aware limits and dynamic Auto resolution.
- Deterministic engine5: separate support/marking lanes, directional through balls with receiving space, moving first touches, charged shot trajectories, goalkeeper anticipation/dive/parry/rebound, swept goal-line contacts and woodwork. THROUGH uses bit14; the high bit stays reserved.1200 Uint16 samples still encode to3200 chars within the4096-byte action cap. Old engines1–4 are immutable and finish with their original rules.
- APK delivery uses the private Sites R2 binding so a larger native asset bundle does not consume the Worker's compressed code limit. An expiring capability can upload only the exact approved bytes/SHA/size to an immutable private object. GET/HEAD/ranges stream through the Worker; there is no public bucket URL. Existing launch gates remain authoritative.

## Verification

347 full automated checks and3 web-draft checks passed. Additional final storage and match UI checks passed after packaging. The native plugin was directly compiled against Android36/Capacitor8 and the complete Android build succeeded. Native index bytes and bundled license file match; sideload signing certificate remains968e6554f40e6cdc7e134c731c3ec42402c3fb9181f3e015b614da7d81d0204b.

The real GLB was parsed and animated in CPU tests: skinned meshes, clothing, joint tracks and quaternion/head bounds verified. A separately rendered running model preview is outputs/pro5-running-asset.png; it is an asset inspection, not an Android screenshot.

Supported browser-control/cua tools are absent in this managed environment. No app/browser screenshot, physical touch/orientation result, sustained phone FPS/temperature or FC-level production parity is claimed. The new build still needs real-device visual/performance review. Public APK/web opening remains January1 2027 at10:00 Danish time; Google Play is not being released.
