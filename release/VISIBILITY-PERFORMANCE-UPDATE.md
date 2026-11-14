# Build29 — roof obstruction, distant camera and frame load

Owner screenshots showed the camera-side roof covering the playable field, small players and poor performance.

- Stadium structure materials now clip the camera-facing side/end, and fully clipped structures are omitted from drawing. The surrounding ground and gameplay objects are preserved. This handles TV, Pro, follow and overview rather than relying on moving the lens around the roof.
- The fixed professional lens is closer/narrower (Pro offset30/3, height19, FOV44); it still has no game-driven zoom. TV is also lower/narrower. Legacy replay physics are unchanged.
- Auto uses a separate decimated skinned model with under half the triangles and the same rig/material coverage. Sharp/4K retain the detailed model. Auto crowd density is reduced and the renderer avoids repeated temporary pose quaternion allocations.
- Auto/4K drawing targets30fps; Sharp retains60fps. A one-time upgrade migration changes a previously stored4K/Sharp setting to Auto. A subsequent explicit4K selection persists. Hardware/FPS claims require physical-device measurement; no guarantee is inferred from these limits.
- Both GLBs use the same existing CC0/MIT/CMU notices. Native assets remain offline-capable; menus/site appearance and January1 public release gates are retained.

Three new checks reproduce the former roof sightline obstruction, verify clear sampled camera/field sightlines after cutaway, quantify model triangle reduction/rig preservation and check the one-time performance setting migration. The prior fixed-lens regression tests continue to pass. Full suite:354 automated checks passed; final targeted visibility/player checks passed after coarse structure culling. Android build, native HTML equality, signing, release metadata and private HTTPS file checksum are validated separately.

The changes still need real-phone visual, sustained frame/thermal and touch verification. CPU ray intersections and asset checks do not certify the final GPU image or phone performance.
