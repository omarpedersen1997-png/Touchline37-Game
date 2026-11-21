import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export async function verifyMatchAssets(root='public/match-assets55'){
 const manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'));
 for(const f of manifest.files){
  const bytes=await readFile(root+'/'+f.file);assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);
  if(f.file.endsWith('.glb')){assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);const j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
   for(const mesh of j.meshes)for(const p of mesh.primitives){for(const required of ['POSITION','NORMAL','TEXCOORD_0'])assert(Number.isInteger(p.attributes[required]),f.file+': '+required);}
   assert((j.images||[]).every(i=>!i.uri),'No remote images');
   if(f.skinned){assert(j.skins.length>0);for(const name of ['idle','walk','run','sprint','turn','pass','shoot','tackle','dive','cheer'])assert(j.animations.some(a=>a.name===name));}
  }
  if(f.file.endsWith('.wav')){assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WAVE');}
 }
 return {files:manifest.files.length,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),hardAssetLimit:null};
}
if(process.argv[1]?.endsWith('/verify-match-assets.mjs'))console.log(JSON.stringify(await verifyMatchAssets()));
