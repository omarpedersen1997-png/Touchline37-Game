"""Prepare a public handoff archive without exposing the owner's support address."""
from pathlib import Path
import json,zipfile,hashlib
root=Path('release');meta=json.loads((root/'publisher.json').read_text());version=meta['versionName'];private_email=meta['supportEmail'];aab=Path(f'outputs/android/Touchline-{version}-UNSIGNED.aab');apk=Path(f'outputs/android/Touchline-{version}.apk');apk=apk if apk.exists() else Path(f'outputs/android/Touchline-{version}-test.apk')
checks=''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in [apk,aab])
output=root/f'downloads/Touchline-{version}-Play-pakke.zip'
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
 z.write(aab,aab.name);z.writestr('SHA256SUMS.txt',checks)
 for file in [*[root/name for name in ['START-HER.md','GOOGLE-PLAY.md','LAUNCH-CHECKLIST.md','PLAY-CONSOLE-ANSWERS.md','STORE-LISTING-DA.md','DEVICE-CHECKLIST.md','TEST-REPORT.md','MAIL-SETUP.md','WEB-LAUNCH.md','CHANGELOG-1.1.0.md','CHANGELOG-1.2.0.md','CHANGELOG-1.2.1.md','CHANGELOG-1.3.0.md','CHANGELOG-2.0.0.md','CHANGELOG-2.0.1.md','PUBLIC-LAUNCH.md','CHANGELOG-1.0.0-PUBLIC.md']],root/'THIRD-PARTY-NOTICES.txt',root/'publisher.json']:
  text=file.read_text().replace(private_email,'UDFYLD_SUPPORTMAIL_I_PLAY_CONSOLE')
  z.writestr(file.name,text)
 for file in (root/'store-assets').glob('*'):z.write(file,'store-assets/'+file.name)
with zipfile.ZipFile(output) as z:
 for name in z.namelist():
  assert private_email.encode() not in z.read(name), 'Public archive must not expose support address'
print('Public Play handoff archive prepared; support address redacted.')
