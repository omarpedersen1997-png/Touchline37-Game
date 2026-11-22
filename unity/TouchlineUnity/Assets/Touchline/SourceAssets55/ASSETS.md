# Touchline TEST55 asset provenance

These assets are shipped locally in the test APK and the opt-in local web build.
They are not extracted from EA/FIFA/FC or another commercial game.

## Four skinned footballers

`player-auto.glb`, `player-detail.glb`, `keeper-auto.glb`, `keeper-detail.glb`
are derivatives of the existing MakeHuman CC0 / Ara procedural footballer.
The full original notices are retained in `assets/game/FOOTBALL-ASSET-LICENSES.md`
and in this directory as `FOOTBALL-ASSET-LICENSES.md`.
Original photographic skin/eye maps, normals, UVs and the 26-joint skeleton remain.
TEST55 adds UV fabric maps, glove shells weighted to the hand bones and embedded
glTF animation clips: idle, walk, run, sprint, strafe_left/right, turn, pass,
shoot, tackle, dive and cheer. Run/walk/strafe derive from the existing baked CMU
motion data; football action poses are original authored motion, not new mocap.
CMU acknowledgement: mocap.cs.cmu.edu; NSF EIA-0196217. Do not resell motion alone.

## Original stadium and surface art

`stadium-kit.glb` contains original UV-mapped/PBR models of a goal frame,
woven net, curved dugout, tiered covered seating, seated spectator, lattice
floodlight tower, rippled corner flag and football, plus stand-low and
spectator-low mesh LODs for Auto. Original PNG textures are
procedurally authored turf color/normal/roughness (1024 and 2048), fabric maps,
leather, glove grip, concrete, Touchline advertising, jersey-number atlases
(1024/2048) and a fictional TL emblem.
These are designed textures, not claimed photographic scans or real club crests.
Original TEST55 art/effect contributions may be used and modified with this game.
Generators are in `dev/assets/`; original inputs remain unchanged.

## Recorded crowd audio — CC BY 4.0

Creator: **Gregor Quendel** — Free Crowd Cheering Sounds.
Source: https://opengameart.org/content/free-crowd-cheering-sounds
Creator: https://www.gregorquendel.com/
License: https://creativecommons.org/licenses/by/4.0/
Download: https://opengameart.org/sites/default/files/gregor_quendel_-_free_crowd_cheering_sounds_-_mp3.zip

`ambience.wav`: excerpt of track 10, Ambience (30 seconds).
`crowd-goal.wav`: excerpt of track 04, Strong cheering II Short (7 seconds).
`crowd-chance.wav`: excerpt of track 05, Soft cheering I (3 seconds).
Changes: trimmed, faded, gain adjusted, converted to 44.1 kHz stereo PCM WAV.
Credit and license must remain with redistributions. No endorsement is implied.

## Original file-based effects

`kick-soft.wav`, `kick-hard.wav`, `woodwork.wav`, `net.wav`, `whistle.wav` are
original offline-generated Foley-style effects, exported to 44.1 kHz PCM WAV.
They are **not recordings**. Unlike the old runtime tones, these files are
packaged, decoded once and played through reusable AudioBuffers. The old tonal
fallback remains available only if local decoding fails or in a legacy build.

`manifest.json` records the size, dimensions/clip names and SHA-256 of each file.
No padding files or unused source MP3 archive are included to inflate APK size.
