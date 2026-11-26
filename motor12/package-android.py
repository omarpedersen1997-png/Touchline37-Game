"""Wrap the local Motor 12 build in the verified TEST65 Capacitor test shell."""
import argparse
from hashlib import sha256
import os
from pathlib import Path
import re
import struct
import subprocess
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZIP_DEFLATED

BASELINE = 'a0313ab94368122af568fa082b0b9ce9947e1ca59cea85b7aacea369adba82ee'
APP_ID = 'dk.touchline.footballidle.test'
ASSETS = 'assets/public/'
LAUNCHER = b'''<!doctype html><html lang="da"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/motor12/play/index.html"><title>Touchline Motor 12</title><p><a href="/motor12/play/index.html">Klubhuset</a></p><p><a href="/legacy.html">Motor 11</a></p></html>'''

def manifest(source, build):
    data = bytearray(source)
    found = 0
    for encoding in ('utf-8', 'utf-16-le'):
        old = '1.0.0-test-match65'.encode(encoding)
        new = f'1.0.0-test-match{build}'.encode(encoding)
        found += data.count(old)
        data = data.replace(old, new)
    assert found == 1
    cursor = 8
    resources = ()
    changed = 0
    while cursor < len(data):
        kind, header, size = struct.unpack_from('<HHI', data, cursor)
        assert 8 <= header <= size
        if kind == 0x180:
            resources = struct.unpack_from('<' + 'I' * ((size-header)//4), data, cursor+header)
        elif kind == 0x102:
            offset, stride, count = struct.unpack_from('<HHH', data, cursor+24)
            for i in range(count):
                pos = cursor+16+offset+i*stride
                name = struct.unpack_from('<I', data, pos+4)[0]
                if name < len(resources) and resources[name] == 0x0101021b:
                    assert data[pos+15] == 0x10 and struct.unpack_from('<I', data, pos+16)[0] == 65
                    struct.pack_into('<I', data, pos+16, build)
                    changed += 1
        cursor += size
    assert changed == 1
    return data

def main():
    parser = argparse.ArgumentParser()
    for name in ('shell','web','sdk','signing','output'):
        parser.add_argument('--'+name, type=Path, required=True)
    parser.add_argument('--build-number', type=int, choices=[66, 67], default=67)
    args = parser.parse_args()
    assert sha256(args.shell.read_bytes()).hexdigest() == BASELINE
    assert b'/legacy.html' in (args.web/'play/index.html').read_bytes()
    props = dict(line.split('=', 1) for line in (args.signing/'touchline-test.properties').read_text().splitlines()
                 if '=' in line and not line.startswith('#'))
    env = dict(os.environ, MOTOR12_STORE=props['storePassword'], MOTOR12_KEY=props['keyPassword'])
    def run(tool, *fields, **options):
        return subprocess.run([str(args.sdk/tool), *map(str, fields)], check=True, text=True, capture_output=True, **options).stdout
    def cert(path):
        return re.search(r'certificate SHA-256 digest: (\S+)', run('apksigner','verify','--print-certs',path))[1]
    with TemporaryDirectory(prefix='motor12-sign-', dir=args.output.parent) as temp:
        unsigned=Path(temp)/'unsigned.apk'
        aligned=Path(temp)/'aligned.apk'
        with ZipFile(args.shell) as old, ZipFile(unsigned,'w',ZIP_DEFLATED) as result:
            for entry in old.infolist():
                path=entry.filename
                if re.match(r'^META-INF/.*\.(?:SF|RSA|DSA|EC|MF)$',path,re.I):
                    continue
                data=old.read(entry)
                if path=='AndroidManifest.xml':
                    data=manifest(data,args.build_number)
                if path==ASSETS+'index.html':
                    result.writestr(ASSETS+'legacy.html',data)
                    data=LAUNCHER
                result.writestr(entry,data)
            for file in sorted(args.web.rglob('*')):
                if file.is_file():
                    result.write(file,ASSETS+'motor12/'+file.relative_to(args.web).as_posix())
        run('zipalign','-f','-P','16','4',unsigned,aligned)
        run('apksigner','sign','--ks',args.signing/'touchline-test.jks','--ks-key-alias',props['keyAlias'],
            '--ks-pass','env:MOTOR12_STORE','--key-pass','env:MOTOR12_KEY','--out',args.output,aligned,env=env)
    assert cert(args.shell)==cert(args.output)
    run('zipalign','-c','-P','16','4',args.output)
    info=run('aapt','dump','badging',args.output).splitlines()[0]
    assert f"name='{APP_ID}'" in info and f"versionCode='{args.build_number}'" in info and f"versionName='1.0.0-test-match{args.build_number}'" in info
    with ZipFile(args.shell) as old, ZipFile(args.output) as result:
        assert result.testzip() is None
        assert result.read(ASSETS+'index.html')==LAUNCHER
        assert result.read(ASSETS+'legacy.html')==old.read(ASSETS+'index.html')
        for name in old.namelist():
            if re.match(r'classes\d*\.dex$|resources\.arsc$',name) or (name.startswith(ASSETS) and name!=ASSETS+'index.html'):
                assert result.read(name)==old.read(name), name
        for file in args.web.rglob('*'):
            if file.is_file():
                assert result.read(ASSETS+'motor12/'+file.relative_to(args.web).as_posix())==file.read_bytes()
    print(info)
    print('APK, signatur, legacy-filer og Motor 12-build verificeret.')
    print(sha256(args.output.read_bytes()).hexdigest())

if __name__=='__main__':
    main()
