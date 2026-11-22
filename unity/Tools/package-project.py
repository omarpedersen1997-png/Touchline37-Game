from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parents[1];out=root/'Artifacts/TouchlineUnity-Foundation-6000.6.10f1.zip';excluded={'Artifacts','bin','obj','Library','Temp','Logs','UserSettings','.vs','.idea'};files=[]
for p in sorted(root.rglob('*')):
 if not p.is_file() or any(part in excluded for part in p.relative_to(root).parts):continue
 if p.relative_to(root).as_posix() in {'Evidence/archive.json','Evidence/delivery.json'}:continue
 if p.suffix in {'.keystore','.jks','.ulf','.lic'}:raise RuntimeError('Følsom fil må ikke pakkes: '+str(p))
 files.append(p)
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,'unity/'+str(p.relative_to(root)))
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 for p in files:assert z.read('unity/'+str(p.relative_to(root)))==p.read_bytes()
result={'file':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'files':len(files),'crc':'pass','allFilesByteEqual':True,'isUnityApk':False}
(root/'Evidence/archive.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
