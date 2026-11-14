# Build31 — rendering load and frame pacing

Gameplay remains engine6 with two 120-second halves and a 10-second interval. Replay physics, score/reward verification, fixed lens, ball visibility, public January1 launch gates and the locked menus/marketing design are unchanged.

## Changes

- Each human's 13 skinned parts now share one bone palette, rather than 13 separate cloned palettes. Palettes/bones remain independent between players.
- Compatible opaque, untextured clothing and boot parts merge using vertex colours. Both shipped LODs go from 13 to 7 skinned meshes while keeping exactly 9550/25717 triangles. Mapped skin, eyes, hair, shirt patterns and alpha settings remain separate. Shared immutable merged geometry is cached by source and palette; materials remain per-player.
- Camera frustum culling uses a conservative 2.8m body sphere. Hidden players advance their animation clock without calculating poses. Re-entering players sample the current pose. Hidden cached LODs are not updated or drawn.
- The scene initializes static world matrices once; per-frame updates visit visible player roots and moving ball/markers/nets/effects. Stadium transforms are retained.
- A phase-preserving 30/60Hz draw scheduler avoids accumulating delays from uneven animation callbacks. It skips missed frames after a stall, independently of deterministic 50ms physics/input steps.
- B now labels its actual action: Aflever, Skift or Kald. Controls reset at halftime and completion to avoid held inputs carrying over the interval.

## Validation

All 369 automated checks and 3 web-draft checks passed. New checks compare both real rigged assets with their unoptimized path: identical triangle counts, retained material maps, original colours, and sampled skinned vertex positions through running, kicking and diving. They verify independent player rigs, shared immutable geometry, animation catch-up, matrix-update isolation, conservative body bounds, and frame cadence through uneven callbacks/stalls.

These counts measure the rendering workload; they do not establish a phone FPS gain. Managed browser/CUA tools are unavailable, so no browser/GPU screenshot or physical-device frame/thermal/touch test is claimed. Android packaging, native HTML equality, signing and private HTTPS delivery are checked separately before handoff.
