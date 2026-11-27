"""Check the signed APK's launcher, offline contents and update compatibility."""
import argparse
from pathlib import Path
import re
import subprocess
from zipfile import ZipFile

p=argparse.ArgumentParser()
for name in ('apk','previous','tools'):
    p.add_argument('--'+name,required=True,type=Path)
args=p.parse_args()
def run(tool,*options):
    return subprocess.check_output([str(args.tools/tool),*map(str,options)],text=True)
def certificate(path):
    return re.search(r'certificate SHA-256 digest: (\w+)',run('apksigner','verify','--print-certs',path)).group(1)
info=run('aapt','dump','badging',args.apk)
assert "name='dk.touchline.footballidle.test' versionCode='78'" in info
assert "launchable-activity: name='dk.touchline.career.TouchlineActivity'" in info
assert args.previous!=args.apk and certificate(args.apk)==certificate(args.previous)
assert 'android.permission.INTERNET' not in run('aapt','dump','permissions',args.apk)
run('zipalign','-c','-P','16','4',args.apk)
with ZipFile(args.apk) as archive:
    assert archive.testzip() is None
    dex=archive.read('classes.dex')
    assert b'Ldk/touchline/career/Motor12;' in dex
    assert b'Landroid/webkit/WebView;' in dex and b'com/getcapacitor/' not in dex
    assert {n for n in archive.namelist() if n.endswith(('.js','.html','.css'))} == {'assets/arena/arena.js','assets/arena/index.html'}
    for asset in ('kits.webp','tribune.webp','turf.webp','whistle.ogg','crowd-goal.ogg','ambience.ogg','stadium.webp'):
        assert archive.getinfo('assets/'+asset).file_size>0
print('PASS Android-launcher, version, opdateringscertifikat, native DEX, offline-aktiver og ZIP-justering')
