import{test}from'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{mkdtemp,mkdir,writeFile,rm,symlink}from'node:fs/promises';
import{join}from'node:path';
import{tmpdir}from'node:os';
import{deflateSync}from'node:zlib';
import{is4KSiteCapture,siteCapturePolicy}from'../shared/site-capture-policy.js';
import{imageCaptureDimensions,loadVerifiedSiteCaptures}from'../scripts/verify-site-captures.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function crc32(bytes){let crc=0xffffffff;for(const value of bytes){crc^=value;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const label=Buffer.from(type),buffer=Buffer.alloc(data.length+12);buffer.writeUInt32BE(data.length);label.copy(buffer,4);data.copy(buffer,8);buffer.writeUInt32BE(crc32(Buffer.concat([label,data])),data.length+8);return buffer;}
// Synthetic fixtures are never published. Full pixel rows make sure the
// verifier checks image data instead of trusting a forged width/height header.
function png(width,height,rows=height){const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((width+1)*rows))),chunk('IEND',Buffer.alloc(0))]);}
const fullPng=png(3840,2160);
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'touchline-capture-check-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'release/downloads'),{recursive:true});await mkdir(join(root,'assets/site/captures'),{recursive:true});
 const apk=Buffer.from('test signed APK bytes'),release={version:'1.0.0',versionCode:36,apk:'Touchline-1.0.0.apk',sha256:hash(apk)};
 const manifest={schemaVersion:1,required:true,versionCode:36,apkSha256:release.sha256,screenshots:[{id:'clubhouse',src:'/assets/captures/build-36-clubhouse.png',title:'Dit klubhus.',description:'Kluboverblik fra den aktuelle app.',alt:'Touchlines klubhus med stadion og næste kamp.',width:3840,height:2160,sha256:hash(fullPng)}]};
 const save=async()=>{await writeFile(join(root,'release/site-captures.json'),JSON.stringify(manifest));await writeFile(join(root,'release/downloads/current.json'),JSON.stringify(release));};
 await writeFile(join(root,'release/downloads',release.apk),apk);await writeFile(join(root,'assets/site/captures/build-36-clubhouse.png'),fullPng);await save();
 return{root,manifest,release,save};
}

test('4K policy accepts both orientations and rejects narrow, short or invented dimensions',()=>{
 for(const[w,h]of[[3840,2160],[2160,3840],[7680,4320]])assert(is4KSiteCapture(w,h));
 for(const[w,h]of[[3839,2160],[3840,2159],[576,1280],[3840,2160.1],[Infinity,2160],['3840',2160],[17000,2160]])assert(!is4KSiteCapture(w,h));
});
test('verified capture output contains exact original file bytes and accessible UI metadata',async t=>{
 const f=await fixture(t),result=await loadVerifiedSiteCaptures({root:f.root,strict:true});
 assert.deepEqual(result.errors,[]);assert.equal(result.screenshots.length,1);assert.equal(result.screenshots[0].alt,f.manifest.screenshots[0].alt);
 const asset=result.assets[f.manifest.screenshots[0].src];assert.equal(asset.contentType,'image/png');assert.equal(asset.sha256,hash(fullPng));assert.deepEqual(asset.bytes,fullPng);
 assert.deepEqual(imageCaptureDimensions(fullPng),{width:3840,height:2160,contentType:'image/png'});
});
test('every APK version or checksum change immediately hides old screenshots and fails required release verification',async t=>{
 const f=await fixture(t);
 for(const change of [()=>f.release.versionCode++,()=>{f.release.versionCode=36;f.release.sha256='a'.repeat(64);}]){
  change();await f.save();const hidden=await loadVerifiedSiteCaptures({root:f.root});assert.deepEqual(hidden.screenshots,[]);assert.deepEqual(hidden.assets,{});
  await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true}),/recaptured|different APK/);
 }
});
test('missing captures remain absent during development while an explicit release requirement blocks them',async t=>{
 const f=await fixture(t);f.manifest.required=false;f.manifest.screenshots=[];await f.save();
 assert.deepEqual((await loadVerifiedSiteCaptures({root:f.root,strict:true})).screenshots,[]);
 await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true,requireCaptures:true}),/original 4K screenshots/);
 await rm(join(f.root,'release/site-captures.json'));assert.deepEqual((await loadVerifiedSiteCaptures({root:f.root})).screenshots,[]);
 await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true,requireCaptures:true}),/Website screenshots/);
});
test('image dimensions and encoded pixels are checked instead of trusting the manifest',async t=>{
 const f=await fixture(t),file=join(f.root,'assets/site/captures/build-36-clubhouse.png');
 for(const bytes of[png(1920,1080),png(3840,2160,2)]){
  await writeFile(file,bytes);delete f.manifest.screenshots[0].sha256;await f.save();
  assert.deepEqual((await loadVerifiedSiteCaptures({root:f.root})).screenshots,[]);
  await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true}),/dimensions|pixel/);
 }
});
test('corruption, filename type and optional original file checksum cannot be silently accepted',async t=>{
 const f=await fixture(t),file=join(f.root,'assets/site/captures/build-36-clubhouse.png');
 f.manifest.screenshots[0].sha256='f'.repeat(64);await f.save();await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true}),/checksum differs/);
 f.manifest.screenshots[0].sha256=hash(fullPng);f.manifest.screenshots[0].src='/assets/captures/build-36-clubhouse.jpg';await writeFile(join(f.root,'assets/site/captures/build-36-clubhouse.jpg'),fullPng);await f.save();await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true}),/file type/);
 f.manifest.screenshots[0].src='/assets/captures/build-36-clubhouse.png';await f.save();const corrupt=Buffer.from(fullPng);corrupt[29]^=1;await writeFile(file,corrupt);await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true}),/PNG checksum/);
});
test('capture routes reject traversal and duplicates, and symlinks cannot expose files outside the capture directory',async t=>{
 const f=await fixture(t),item=f.manifest.screenshots[0];
 for(const src of['/assets/captures/../secret.png','https://example.test/image.png','/assets/gallery/old.jpg']){assert(!siteCapturePolicy({...f.manifest,screenshots:[{...item,src}]},f.release).valid);}
 assert(!siteCapturePolicy({...f.manifest,screenshots:[item,item]},f.release).valid);
 await writeFile(join(f.root,'outside.png'),fullPng);await rm(join(f.root,'assets/site/captures/build-36-clubhouse.png'));await symlink(join(f.root,'outside.png'),join(f.root,'assets/site/captures/build-36-clubhouse.png'));
 await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true}),/outside the capture/);
});
test('capture approval is invalid if the local signed APK differs from the release checksum',async t=>{
 const f=await fixture(t);await writeFile(join(f.root,'release/downloads',f.release.apk),'different APK');
 assert.deepEqual((await loadVerifiedSiteCaptures({root:f.root})).screenshots,[]);await assert.rejects(loadVerifiedSiteCaptures({root:f.root,strict:true}),/signed APK file differs/);
});
