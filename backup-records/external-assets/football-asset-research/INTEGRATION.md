# Footballer integration

Recommended GLB: `touchline-footballer-v2.glb` (slim dark footwear).
First version: `touchline-footballer.glb` (chunkier sneakers).
Preview: `footballer-v2-preview.png` / `footballer-preview.png`.

Generated adult age25, height1.83m. Real human topology, face, hands and photographic skin texture. Fully covered torso/pelvis/feet with original blue shirt, white shorts, blue socks and dark footwear. Geometry hidden by the clothing was removed during generation. No logos, real club names or real footballer likeness.

Format: self-contained, uncompressed glTF2 GLB. No Draco/Meshopt decoder required. +Y up, faces +Z, metres. Rest pose is an A-pose. One26joint humanoid skeleton shared by13skinned mesh parts. Standard bones Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder/Arm/ForeArm/Hand, RightShoulder/Arm/ForeArm/Hand, LeftUpLeg/Leg/Foot/ToeBase, RightUpLeg/Leg/Foot/ToeBase. HeadTop_End, toe end bones and unused WeaponR are also present. No facial blendshapes and no animations.

`footballer-bones.json` records local bind translations and quaternions for v1 (v2 uses the same rest skeleton). Bones use local+Y along bone, local+Z toward front. Save each bone's quaternion after load; multiply an axis-angle animation delta onto that rest quaternion instead of replacing the absolute orientation. Leg bind quaternions point down. To lower arms from their A-pose, use the local axes or convert an intended world swing axis through the parent's world rotation. Check preview from front/side before reusing every animation on all players.

Load with GLTFLoader.parse(ArrayBuffer) if embedding as base64 in the native single HTML build. Clone the loaded scene using Three.js SkeletonUtils.clone, preserving the13parts' shared skeleton. Clone materials per player for team/skin variations while reusing texture images and geometries.

Team-recolor material names: `Football Shirt`, `Football Shorts`, `Football Socks`. Their PBR base-color factors are clean solid colors with no tint-baked diffuse maps. Shoes have `Sneaker leather`, `Sneaker midsole`, `Sneaker outsole`, `Sneaker laces` (names retained from adapted source generator). Other materials: `Skin`, `Skin details`, `Eyes`, `Eyebrows`, `Buzz cut`.

v1 statistics: 27,216triangles, 1,400,032bytes, gzip800,871bytes, sixembeddedimages (skin1024, eyes256, brows256, detail512, roughness256, smallhairalpha). Skinface detail was preserved at80%mesh, dense scalp and shoe lace geometry reduced separately. 22players imply about600ktriangles and286drawcalls before game shadowpasses. This is feasible on recent Android GPUs with modest shadowmaps and rendering scale; distant-player LOD or material consolidation can reduce load further.

License and source evidence: `ASSET-LICENSES.md`, `makehuman-license.md`, `ara-assets-license.txt`, pinned local generator `ara/`. Custom kit/shoe shaping edits are in `ara/src/core/garments/catalog.ts`, `ara/src/core/garments/sneakers.ts`. Rebuild input: `footballer-v2.params.json`. The export was optimized with `optimize_footballer_v2.py`; Blender scene `touchline-footballer-v2.blend` preserves rig and editable parts. The fully detailed original intermediate is under`out/`.
