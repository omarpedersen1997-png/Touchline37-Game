// Read-only download-size review. APK growth is advisory, never a 5MB gate.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SIZE_POLICY,assessClientSize} from './size-policy.mjs';
const path=process.argv[2];
if(!path)throw Error('Angiv APK-fil som argument.');
const bytes=readFileSync(path),assessment=assessClientSize({apkBytes:bytes.length});
console.log(JSON.stringify({file:path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),policy:SIZE_POLICY.apk,...assessment},null,2));
if(assessment.errors.length)process.exitCode=1;
