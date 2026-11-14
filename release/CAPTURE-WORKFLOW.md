# Current-version 4K app pictures

Website pictures must come from the **exact signed APK** in
`release/downloads/current.json`. An APK version or checksum change invalidates
the old gallery. Normal builds hide stale pictures; `npm run release:check`
requires new valid pictures before a release can pass.

For repeatable web-view captures run `python3 scripts/capture-app-web-4k.py`. It serves byte-identical HTML from the signed APK with the real Worker API and isolated SQLite storage, then uses the installed Chromium to capture the current UI directly at 960 × 540 CSS pixels and devicePixelRatio 4. Direct JPEG quality 98 captures retain all 3840 × 2160 pixels. Provenance and website captions must identify these as web-view captures, not Android device captures. The script must never resize an existing screenshot.

For native Android captures use the Android capture emulator or a test device with a genuine 3840 × 2160
landscape framebuffer. Never resize a smaller screenshot. On the capture AVD:

```sh
adb -s emulator-5554 shell wm size 2160x3840
adb -s emulator-5554 shell wm density 640
adb -s emulator-5554 shell wm user-rotation lock 1
adb -s emulator-5554 install -r release/downloads/Touchline-1.0.0.apk
adb -s emulator-5554 shell am start -n dk.touchline.footballidle/.MainActivity
```

The installed activity locks the entire app to landscape. Before capture,
check that the screen has finished rendering, system dialogs are closed, no
private account information is visible, and the current app has no error.
Use a disposable QA account and remove it when signed-in captures are finished.
Use real 4K rendering for match footage; do not photograph an upscaled Auto
canvas and call it 4K gameplay. Software emulator speed is not phone FPS proof.

Navigate to each screen and capture its original framebuffer, for example:

```sh
python3 scripts/capture-android-4k.py \
  --id clubhouse --title 'Dit klubhus.' \
  --description 'Klubbens næste kamp, økonomi og udvikling.' \
  --alt 'Touchline-klubhus i bredformat med klubbens overblik og næste kamp.'
```

Repeat for the squad, club development and actual match. The helper checks the
installed APK bytes, version, foreground app and full PNG dimensions. It saves
the unchanged PNG under `assets/site/captures/` and writes its checksum and
capture provenance into `release/site-captures.json`. A new APK starts a new
manifest, so earlier captures cannot remain marked as current.

Finally run:

```sh
node scripts/verify-site-captures.mjs --require-captures
npm run release:check
```

The build injects only verified files into the website. Open each final image
for a visual check as well: pixel dimensions alone do not prove good framing
or correct content. Capture every new native release as part of its release
work; the user must not supply screenshots.
