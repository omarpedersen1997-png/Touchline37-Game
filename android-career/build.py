"""Build the standalone Android game using the Android SDK, a JDK (17+)."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_STORED, ZipFile

here=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
for key in ('sdk','jdk','signing','output'):
    parser.add_argument('--'+key,required=True,type=Path)
args=parser.parse_args()
sdk=args.sdk.resolve();jdk=args.jdk.resolve();sign=args.signing.resolve();output=args.output.resolve()
output.parent.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,JAVA_HOME=str(jdk),PATH=str(jdk/'bin')+':'+os.environ['PATH'])
tools=sdk/'build-tools/36.0.0'
platform=sdk/'platforms/android-36/android.jar'
def run(*cmd):
    subprocess.run(list(map(str,cmd)),env=env,check=True)

with tempfile.TemporaryDirectory(dir=output.parent,prefix='career-build-') as tmp:
    work=Path(tmp);res=work/'res';assets=work/'assets';classes=work/'classes';dex=work/'dex'
    for path in (res/'drawable',assets,classes,dex):path.mkdir(parents=True)
    shutil.copytree(here/'res',res,dirs_exist_ok=True)
    shutil.copytree(here/'assets',assets,dirs_exist_ok=True)
    run(tools/'aapt2','compile','--dir',res,'-o',work/'resources.zip')
    base=work/'base.apk'
    run(tools/'aapt2','link','-o',base,'-I',platform,'--manifest',here/'AndroidManifest.xml','-A',assets,'-0','ogg',work/'resources.zip')
    run(jdk/'bin/javac','--release','8','-encoding','UTF-8','-cp',platform,'-d',classes,*sorted((here/'src').rglob('*.java')))
    run(tools/'d8','--release','--min-api','26','--lib',platform,'--output',dex,*sorted(classes.rglob('*.class')))
    with ZipFile(base,'a') as archive:archive.write(dex/'classes.dex','classes.dex',compress_type=ZIP_STORED)
    aligned=work/'aligned.apk';run(tools/'zipalign','-f','-P','16','4',base,aligned)
    props=dict(l.split('=',1) for l in (sign/'touchline-test.properties').read_text().splitlines() if '=' in l and not l.startswith('#'))
    env.update(TL_KEY_PASS=props['keyPassword'],TL_STORE_PASS=props['storePassword'])
    run(tools/'apksigner','sign','--ks',sign/'touchline-test.jks','--ks-key-alias',props['keyAlias'],'--ks-pass','env:TL_STORE_PASS','--key-pass','env:TL_KEY_PASS','--out',output,aligned)
    run(tools/'apksigner','verify','--verbose','--print-certs',output)
    run(tools/'zipalign','-c','-P','16','4',output)
    with ZipFile(output) as apk:
        assert apk.testzip() is None and {'assets/arena/index.html','assets/arena/arena.js'} <= set(apk.namelist())
        assert all(apk.getinfo('assets/'+name+'.ogg').compress_type==ZIP_STORED for name in ('ambience','whistle','crowd-goal','kick-soft'))
print(output)
