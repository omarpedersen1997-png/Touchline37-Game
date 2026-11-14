"""Capture the current signed Android app at native 4K; never resize pixels.

Navigate the emulator to the requested screen, then call this helper for each
capture. A new APK checksum starts a new manifest so old pictures cannot ship.
The normal release check validates every picture against that exact APK.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = 'dk.touchline.footballidle'


def digest(value):
    return hashlib.sha256(value).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial', default='emulator-5554')
    parser.add_argument('--adb', default='/workspace/android-sdk/platform-tools/adb')
    parser.add_argument('--id', required=True)
    parser.add_argument('--title', required=True)
    parser.add_argument('--description', required=True)
    parser.add_argument('--alt', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,47}', args.id):
        parser.error('Use a simple lower-case capture id.')
    release = json.loads((ROOT/'release/downloads/current.json').read_text())
    apk = ROOT/'release/downloads'/release['apk']
    apk_hash = digest(apk.read_bytes())
    if apk_hash != release['sha256']:
        raise SystemExit('Current signed APK differs from release metadata.')

    def adb(*parts, binary=False):
        return subprocess.check_output([args.adb, '-s', args.serial, *parts],
                                       timeout=180, text=not binary)

    package = adb('shell', 'dumpsys', 'package', PACKAGE)
    version = re.search(r'\bversionCode=(\d+)\b', package)
    if not version or int(version.group(1)) != release['versionCode']:
        raise SystemExit('Install the exact current APK before capturing.')
    # Check the actual installed base APK, not just its public version label.
    installed = adb('shell', 'pm', 'path', PACKAGE).strip().splitlines()
    base = next((line[8:] for line in installed if line.startswith('package:') and line.endswith('/base.apk')), None)
    if not base or digest(adb('exec-out', 'cat', base, binary=True)) != apk_hash:
        raise SystemExit('Installed APK checksum differs from the approved build.')
    windows = adb('shell', 'dumpsys', 'window', 'windows')
    focus = '\n'.join(line for line in windows.splitlines()
                      if 'mCurrentFocus' in line or 'mFocusedApp' in line)
    if PACKAGE not in focus:
        raise SystemExit('Bring Touchline to the foreground before capturing.')

    pixels = adb('exec-out', 'screencap', '-p', binary=True)
    # Pillow validates a real complete image; no decoding transform or save
    # touches the original screenshot bytes stored on the website.
    from PIL import Image
    with Image.open(io.BytesIO(pixels)) as image:
        if image.format != 'PNG' or image.size != (3840, 2160):
            raise SystemExit(f'Expected native landscape 3840×2160 PNG, got {image.format} {image.size}.')
        image.verify()
    native_page_hash = None
    with zipfile.ZipFile(apk) as archive:
        native_page_hash = digest(archive.read('assets/public/index.html'))
    filename = f'{args.id}-{release["versionCode"]}-{apk_hash[:12]}.png'
    folder = ROOT/'assets/site/captures'
    folder.mkdir(parents=True, exist_ok=True)
    (folder/filename).write_bytes(pixels)
    manifest_path = ROOT/'release/site-captures.json'
    try:
        manifest = json.loads(manifest_path.read_text())
    except (FileNotFoundError, ValueError):
        manifest = {}
    if manifest.get('versionCode') != release['versionCode'] or manifest.get('apkSha256') != apk_hash:
        manifest = {'schemaVersion': 1, 'required': True,
                    'versionCode': release['versionCode'], 'apkSha256': apk_hash,
                    'screenshots': []}
    entry = {'id': args.id, 'src': '/assets/captures/'+filename,
             'title': args.title, 'description': args.description, 'alt': args.alt,
             'width': 3840, 'height': 2160, 'sha256': digest(pixels),
             'capturedAt': datetime.now(timezone.utc).isoformat(),
             'provenance': {'method': 'adb exec-out screencap -p',
                            'package': PACKAGE, 'installedApkSha256': apk_hash,
                            'nativePageSha256': native_page_hash,
                            'pixelProcessing': 'none'}}
    manifest['screenshots'] = [item for item in manifest['screenshots'] if item['id'] != args.id] + [entry]
    manifest['required'] = True
    temporary = manifest_path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    temporary.replace(manifest_path)
    print(json.dumps({'capture': entry['src'], 'versionCode': release['versionCode'],
                      'width': 3840, 'height': 2160, 'bytes': len(pixels),
                      'sha256': entry['sha256']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
