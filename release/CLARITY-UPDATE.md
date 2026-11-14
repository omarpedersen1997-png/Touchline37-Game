# Build 32 — image clarity

The owner asked for a clear, sharp match image. New/upgraded engine 6 matches now default once to Sharp, while existing 4K and Simple choices remain intact. A subsequent explicit Auto choice persists. Previous-engine preference behavior is unchanged.

Sharp renders at the viewport's native device-pixel density, supersampling small/low-DPR views to a 1920-pixel long edge and capping at 3840 before GPU limits. For example 900×400 CSS pixels at DPR 2.625 now renders 2363×1050 rather than the former 1800×800 Sharp cap. Sharp ignores automatic pressure scaling and uses the detailed 25.7K-triangle models throughout the team. Explicit 4K continues to target 3840 on the long edge; its truthful hardware-limit status remains. The match draw cadence is 30Hz across quality modes to budget for the increased per-frame quality; physics remains 20Hz and matches remain two 120-second halves plus a 10-second interval.

Antialiasing is requested in every WebGL quality mode; actual context support is recorded in resolution information. Sharp shadows use 2048 maps. Team kit canvases increase from 256 to 512 pixels. Mipmapped linear filtering and GPU-bounded anisotropy (up to 16×, 8× in Auto) apply to pitch, kits, skin and other surface maps without changing their colour spaces, UVs, alpha modes or texture identity. Newly created detail LODs receive the same filtering. Generated jersey-number and label canvases now declare sRGB explicitly so dark outlines retain their intended contrast. No CSS sharpening, pixelated upscaling or artificial edge halo is used.

Auto can no longer undersample below one render pixel per CSS pixel unless GPU output limits require it. Its relative scale floor rises to 0.75. Sustained overload can reduce the scale; sustained spare time recovers it in small steps. Brief stalls do not permanently degrade the image. Scaling inside a draw updates the buffer without a recursive redraw/camera snap.

All 374 automated checks passed, including five new native-resolution, preference-upgrade, Auto recovery and texture-state tests. Three web-draft checks, native packaging/HTML equality/signing, release metadata and private HTTPS file delivery are checked separately. Rendering reductions from build 31 and existing replay/camera/culling tests are retained.

There is no supported managed browser/CUA path here. No GPU image, phone FPS or physical-device visual playtest is claimed. Render-buffer dimensions do not increase the physical screen resolution, add detail absent from source textures, or certify the final perceived sharpness.
