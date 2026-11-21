import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyMatchAssets} from '../scripts/verify-match-assets.mjs';
import {createMatchSampleBank} from '../src/match-sample-bank.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {createFootballPlayer,animateFootballPlayer} from '../src/pro-player.js';
import {instanceRichPart,buildRichGoals,buildRichStadium} from '../src/rich-match-assets.js';

async function geometryAsset(name){
 const bytes=readFileSync('public/match-assets55/'+name),n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n));
 for(const m of j.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.extensions;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
 const text=Buffer.from(JSON.stringify(j)),padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),bin=bytes.subarray(20+n),out=Buffer.alloc(20+padded.length+bin.length);bytes.copy(out,0,0,12);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);bin.copy(out,20+padded.length);
 globalThis.self=globalThis;return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}
test('all packaged binary assets have verified hashes, genuine GLB UV/normal/rig tracks and WAV payloads',async()=>{
 const report=await verifyMatchAssets();assert.equal(report.hardAssetLimit,null);assert(Number.isFinite(report.bytes)&&report.bytes>0);assert.equal(report.files,31);
 const m=JSON.parse(readFileSync('public/match-assets55/manifest.json'));for(const f of m.files.filter(f=>f.file.includes('grass-')&&f.file.includes('2048')))assert.equal(f.width,2048);
 const notice=readFileSync('public/match-assets55/ASSETS.md','utf8');assert(notice.includes('Gregor Quendel'));assert(notice.includes('CC BY 4.0'));assert(notice.includes('not recordings'));
});
test('four new player LOD/keeper GLBs animate independent actual skeletons with grounded finite geometry',async()=>{
 const prior=globalThis.document,ctx=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{for(const name of ['player-auto.glb','player-detail.glb','keeper-auto.glb','keeper-detail.glb']){
  const gltf=await geometryAsset(name);gltf.scene.userData.richPack=true;gltf.scene.animations=gltf.animations;gltf.scene.traverse(o=>{if(o.material?.name==='Keeper glove')o.material.map=new THREE.Texture();});
  const model=createFootballPlayer({source:gltf.scene,number:7,optimize:false,keeper:name.startsWith('keeper')}),other=createFootballPlayer({source:gltf.scene,number:8}),state={version:11,engineRevision:3,controlled:0,freeze:0,lastAction:{kind:'shot',team:'home',index:0}},p={vx:0,vy:-6,x:0,y:0,facingX:0,facingY:-1,kick:0,dive:0,tackle:0};
  let sole;model.traverse(o=>{if(o.material?.name==='Sneaker outsole')sole=o;});assert(sole);const solePoint=new THREE.Vector3();
  assert(model.userData.assetAnimation);const rest=other.userData.bones.RightUpLeg.quaternion.clone();
  for(let i=0;i<120;i++){p.kick=i>=35&&i<47?47-i:0;p.dive=i>=70&&i<82?82-i:0;model.position.z-=6/60;animateFootballPlayer(model,p,state,'home',0,1/60);model.updateMatrixWorld(true);for(const bone of Object.values(model.userData.bones))assert(bone.quaternion.toArray().every(Number.isFinite));if(!p.dive&&i%6===0){let floor=Infinity;for(let k=0;k<sole.geometry.attributes.position.count;k++){sole.getVertexPosition(k,solePoint).applyMatrix4(sole.matrixWorld);floor=Math.min(floor,solePoint.y);}assert(floor>.01&&floor<.052,`${name} frame ${i} floor ${floor}`);}}
  assert(other.userData.bones.RightUpLeg.quaternion.equals(rest));assert.notEqual(model.userData.bones.RightUpLeg.quaternion.x,rest.x);
  if(name.startsWith('keeper')){const gloves=[];model.traverse(o=>{if(o.isSkinnedMesh&&o.material.name==='Keeper glove')gloves.push(o);});assert.equal(gloves.length,2);for(const glove of gloves){const box=new THREE.Box3().setFromObject(glove);assert(box.max.y<2.4&&box.min.y>0);}}
 }}finally{globalThis.document=prior;}
});
test('imported stadium modules are instanced, world scaled, and imported net extends behind both goal lines',async()=>{
 const gltf=await geometryAsset('stadium-kit.glb'),pack={library:gltf.scene,textures:{'stadium-board-2048.png':new THREE.Texture()}},scene=new THREE.Scene(),field={width:60,length:96,goalWidth:8,goalHeight:2.4};
 const batches=instanceRichPart(scene,pack,'spectator',Array.from({length:100},(_,i)=>({x:i,y:0,z:0})));assert(batches.length<=5);for(const b of batches){assert(b.isInstancedMesh);assert.equal(b.count,100);}
 const triangles=name=>{let n=0;gltf.scene.getObjectByName(name).traverse(m=>{if(m.isMesh)n+=m.geometry.index.count/3;});return n;};assert(triangles('spectator-low')<triangles('spectator')*.25);assert(triangles('stand-low')<triangles('stand')*.45);
 const stadium=buildRichStadium(scene,field,'auto',pack);assert(stadium.crowds.every(m=>m.isInstancedMesh));stadium.setCameraView(new THREE.Vector3(30,20,30),new THREE.Vector3());
 const nets=buildRichGoals(scene,field,pack);assert.equal(nets.length,2);for(const net of nets){const box=new THREE.Box3().setFromObject(net);assert(box.max.y<2.5&&box.min.y>-.02);assert(box.min.x>-4.1&&box.max.x<4.1);if(net.userData.netSign>0)assert(box.max.z>49.7&&box.min.z>47.9);else assert(box.min.z< -49.7&&box.max.z< -47.9);}
});
test('file sample bank loads only on demand, caches decodes, limits voices, stops on mute and aborts on dispose',async()=>{
 let fetched=0,decoded=0,allowed=true,stops=0,disconnects=0;const pending=[];
 const context={currentTime:0,state:'running',async decodeAudioData(){decoded++;return{};},createBufferSource(){return{connect(){},disconnect(){disconnects++;},start(){pending.push(this)},stop(){stops++;this.onended?.();}}},createGain(){return{gain:{value:0},connect(){},disconnect(){disconnects++;}}}};
 const bank=createMatchSampleBank(context,{base:'/match-assets55',allowed:()=>allowed,output:{},fetcher:async url=>{assert(url.startsWith('/match-assets55/'));fetched++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(12)}}});
 assert.equal(fetched,0);assert(!bank.play('kick-soft'));await bank.load();await bank.load();assert.equal(fetched,8);assert.equal(decoded,8);assert(bank.ambient());assert(bank.ambient());assert.equal(bank.voices,1);
 for(let i=0;i<7;i++)assert(bank.play('kick-hard'));assert(!bank.play('whistle'));allowed=false;bank.stopAll();assert.equal(bank.voices,0);assert.equal(stops,8);assert(disconnects>=16);assert(!bank.play('net'));bank.dispose();assert.equal(bank.decoded,0);
});
test('audio fetch failure stays safe and late decode cannot retain resources after disposal',async()=>{
 const resolves=[];const context={decodeAudioData:()=>new Promise(r=>resolves.push(r))},bank=createMatchSampleBank(context,{base:'/match-assets55',allowed:()=>true,fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})});
 const load=bank.load();await new Promise(r=>setTimeout(r,0));bank.dispose();for(const resolve of resolves)resolve({});await load;
 // Separate failing fetches finish normally, rather than reject into UI effects.
 const failed=createMatchSampleBank(context,{base:'/match-assets55',allowed:()=>true,fetcher:async()=>{throw Error('offline')}});await failed.load();assert.equal(failed.decoded,0);failed.dispose();assert.equal(bank.decoded,0);
});
test('mapped kits merge only matching surfaces, retain UVs/tint and share immutable geometry across players',async()=>{
 const prior=globalThis.document,ctx=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{
  const gltf=await geometryAsset('player-auto.glb');gltf.scene.userData.richPack=true;gltf.scene.animations=gltf.animations;
  const kitMap=new THREE.Texture(),kitNormal=new THREE.Texture(),kitRoughness=new THREE.Texture(),options={source:gltf.scene,number:7,kitMap,kitNormal,kitRoughness};
  const a=createFootballPlayer(options),b=createFootballPlayer(options),original=createFootballPlayer({...options,optimize:false});let merged,other;const parts=[];
  a.traverse(m=>{if(m.userData.parts?.includes('Football Shirt')&&m.userData.parts.includes('Football Shorts'))merged=m;});
  b.traverse(m=>{if(m.userData.parts?.includes('Football Shirt'))other=m;});original.traverse(m=>{if(['Football Shirt','Football Shorts'].includes(m.material?.name))parts.push(m);});
  assert(merged);assert.equal(merged.geometry,other.geometry);assert.equal(merged.material.map,kitMap);assert.equal(merged.material.normalMap,kitNormal);assert.equal(merged.material.roughnessMap,kitRoughness);
  assert.equal(merged.geometry.attributes.uv.count,parts.reduce((n,m)=>n+m.geometry.attributes.uv.count,0));
  assert(merged.material.vertexColors);const tint=merged.geometry.attributes.color;assert(Array.from(tint.array).some(v=>v<.1));
 }finally{globalThis.document=prior;}
});
