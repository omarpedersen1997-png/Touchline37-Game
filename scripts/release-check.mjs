import {verifyMatchAssets} from '../scripts/verify-match-assets.mjs';
console.log('Lokale kampressourcer (ingen størrelsesgrænse):',await verifyMatchAssets());
import{loadVerifiedSiteCaptures}from'./verify-site-captures.mjs';
import{publisher}from'../src/publisher.js';
import{createHash}from'node:crypto';
import{gzipSync}from'node:zlib';
import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';
const read=p=>readFileSync(p,'utf8');const meta=JSON.parse(read('release/publisher.json')),gradle=read('android/app/build.gradle'),native=read('native-web/index.html'),site=read('generated-page.js');
assert.equal(publisher.build,meta.versionCode);assert.equal(publisher.version,meta.versionName);
assert(gradle.includes(`versionName "${meta.versionName}"`));assert(gradle.includes(`versionCode ${meta.versionCode}`));assert(gradle.includes(`applicationId "${meta.applicationId}"`));assert(native.includes(meta.versionName));
assert(!native.includes(meta.supportEmail));assert(!site.includes(meta.supportEmail));assert(!site.includes('/api/game'));assert(!site.includes('/api/auth/login'));
const download=JSON.parse(read('release/downloads/current.json'));assert.equal(download.version,meta.versionName);assert.equal(download.versionCode,meta.versionCode);assert(download.apk.includes(meta.versionName));assert(download.archive.includes(meta.versionName));assert.equal(download.apk,`Touchline-${meta.versionName}.apk`);assert.equal(createHash('sha256').update(readFileSync('release/downloads/'+download.apk)).digest('hex'),download.sha256);
assert(native.includes('.exp-dna-card'));assert(native.includes('.club-studio-colors'));assert(gzipSync(readFileSync('dist/server/index.js')).length<10*1024*1024,'Worker must fit production 10 MiB compressed limit');
const config=JSON.parse(read('capacitor.config.json'));assert(!config.server.url);assert.equal(config.server.cleartext,false);assert.equal(config.android.allowMixedContent,false);
for(const[file,w,h]of[['icon-512.png',512,512],['feature-graphic-1024x500.png',1024,500]]){const bytes=readFileSync('release/store-assets/'+file);assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h)}
for(const name of['STORE-LISTING-DA.md','PLAY-CONSOLE-ANSWERS.md','LAUNCH-CHECKLIST.md','DEVICE-CHECKLIST.md','THIRD-PARTY-NOTICES.txt'])assert(existsSync('release/'+name));
const listing=read('release/STORE-LISTING-DA.md'),short=listing.split('Kort beskrivelse (maks. 80 tegn):\n')[1].split('\n')[0];assert(short.length<=80);assert(meta.appName.length<=30);assert(listing.includes('https://playtouchline.dk/privacy'));assert(listing.includes('https://playtouchline.dk/delete-account'));
console.log(`Release metadata/assets checks passed: ${meta.versionName} (${meta.versionCode}). Signing, device tests, screenshots and Play declarations still required.`);

await loadVerifiedSiteCaptures({strict:true,requireCaptures:true});
