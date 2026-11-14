import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createFootballPlayer,animateFootballPlayer} from '../src/pro-player.js';
import {updateMatchWorld,playerInFrame,copyPlayerPose} from '../src/player-rendering.js';
import {createMatchFramePacer} from '../src/match-frame-pacer.js';

async function sourceAsset(name){
 const bytes=readFileSync(new URL('../assets/game/'+name,import.meta.url)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),original=structuredClone(json.materials);
 for(const m of json.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.extensions;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}
 const text=Buffer.from(JSON.stringify(json)),padding=(4-text.length%4)%4,j=Buffer.concat([text,Buffer.alloc(padding,32)]),bin=bytes.subarray(20+length),output=Buffer.alloc(20+j.length+bin.length);bytes.copy(output,0,0,12);output.writeUInt32LE(output.length,8);output.writeUInt32LE(j.length,12);output.writeUInt32LE(0x4e4f534a,16);j.copy(output,20);bin.copy(output,20+j.length);
 const source=(await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'')).scene;
 // No image decoder is needed for these geometry/palette tests. Restore map
 // presence with Texture objects so textured surfaces cannot be merged away.
 source.traverse(o=>{if(!o.material)return;const m=original.find(m=>m.name===o.material.name);if(m?.pbrMetallicRoughness?.baseColorTexture)o.material.map=new THREE.Texture();if(m?.pbrMetallicRoughness?.metallicRoughnessTexture){o.material.roughnessMap=new THREE.Texture();o.material.metalnessMap=o.material.roughnessMap;}});
 return source;
}
function meshes(root){const list=[];root.traverse(o=>{if(o.isSkinnedMesh)list.push(o);});return list;}
const triangleCount=root=>meshes(root).reduce((n,m)=>n+m.geometry.index.count/3,0);
const palettes=root=>new Set(meshes(root).map(m=>m.skeleton)).size;
function mockCanvas(){const prior=globalThis.document,priorSelf=globalThis.self,ctx=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.self=globalThis;globalThis.document={createElement:()=>({getContext:()=>ctx})};return()=>{globalThis.document=prior;globalThis.self=priorSelf;};}
function dispose(...roots){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();for(const root of roots)root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isSkinnedMesh)skeletons.add(o.skeleton);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());}

test('both shipped LODs reduce submissions and bone palettes without removing triangles, mapped skin or clothing',async()=>{
 const restore=mockCanvas(),report=[];try{for(const name of ['football-auto.glb','football-pro.glb']){
  const source=await sourceAsset(name),kit=new THREE.Texture(),baseline=createFootballPlayer({source,number:9,kitMap:kit,optimize:false}),optimized=createFootballPlayer({source,number:9,kitMap:kit});
  assert.equal(optimized.userData.label.material.map.colorSpace,THREE.SRGBColorSpace);assert.equal(optimized.userData.jersey.material.map.colorSpace,THREE.SRGBColorSpace);assert.equal(palettes(baseline),13);assert.equal(palettes(optimized),1);assert.equal(triangleCount(optimized),triangleCount(baseline));assert(meshes(optimized).length<=7);assert.equal(meshes(baseline).length,13);
  for(const material of ['Skin','Eyes','Buzz cut','Football Shirt']){const after=meshes(optimized).find(m=>m.material.name===material);assert(after?.material.map,material);}
  const oldParts=meshes(baseline),merged=meshes(optimized).find(m=>m.userData.parts?.includes('Football Socks'));assert(merged);assert(merged.material.vertexColors);
  for(const p of oldParts.filter(m=>merged.userData.parts.includes(m.material.name))){let offset=0;for(const part of merged.userData.parts){if(part===p.material.name)break;offset+=oldParts.find(m=>m.material.name===part).geometry.attributes.position.count;}const c=merged.geometry.attributes.color;for(const i of[0,Math.floor(p.geometry.attributes.position.count/2),p.geometry.attributes.position.count-1]){const actual=new THREE.Color().fromBufferAttribute(c,offset+i);assert(Math.abs(actual.r-p.material.color.r)<1e-6&&Math.abs(actual.g-p.material.color.g)<1e-6&&Math.abs(actual.b-p.material.color.b)<1e-6);}}
  const player={vx:1,vy:-6,kick:0,dive:0,tackle:0},state={freeze:0,events:[],controlled:0};
  for(let frame=0;frame<90;frame++){
   player.kick=frame>=30&&frame<42?42-frame:0;player.dive=frame>=60&&frame<70?70-frame:0;player.diveX=1;player.actionDuration=16;
   for(const model of[baseline,optimized]){animateFootballPlayer(model,player,state,'home',0,1/30);model.position.x=8;model.position.z=-12;model.rotation.y=.4;model.updateMatrixWorld(true);}
   if(frame%15===0){let offset=0;for(const part of merged.userData.parts){const original=oldParts.find(m=>m.material.name===part),n=original.geometry.attributes.position.count;for(const i of[0,Math.floor(n/2),n-1]){const a=original.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(original.matrixWorld),b=merged.getVertexPosition(offset+i,new THREE.Vector3()).applyMatrix4(merged.matrixWorld);assert(a.distanceTo(b)<1e-5,`${name} ${part} ${frame}`);}offset+=n;}}
  }
  report.push({asset:name,triangles:triangleCount(optimized),beforeMeshes:13,afterMeshes:meshes(optimized).length,beforePalettes:13,afterPalettes:palettes(optimized)});dispose(baseline,optimized,source);kit.dispose();
 }writeFileSync(new URL('../outputs/render31-player-budget.json',import.meta.url),JSON.stringify(report,null,2));}finally{restore();}
});

test('players share immutable clothing geometry but retain independent materials, bones and animation',async()=>{
 const restore=mockCanvas();try{const source=await sourceAsset('football-auto.glb'),a=createFootballPlayer({source,number:7}),b=createFootballPlayer({source,number:7}),sa=meshes(a)[0].skeleton,sb=meshes(b)[0].skeleton;
 assert.notEqual(sa,sb);assert(sa.bones.every((bone,i)=>bone!==sb.bones[i]));const ma=meshes(a).find(m=>m.userData.parts),mb=meshes(b).find(m=>m.userData.parts);assert.equal(ma.geometry,mb.geometry);assert.notEqual(ma.material,mb.material);
 const before=b.userData.bones.RightUpLeg.quaternion.clone();animateFootballPlayer(a,{vx:0,vy:-6,kick:8,dive:0,tackle:0},{freeze:0,events:[],controlled:0},'home',0,.05);assert(b.userData.bones.RightUpLeg.quaternion.equals(before));a.userData.inView=false;copyPlayerPose(a,b);assert.equal(b.userData.inView,false);assert.equal(b.userData.motionTime,a.userData.motionTime);assert(Object.keys(b.userData.bones).every(name=>b.userData.bones[name].quaternion.equals(a.userData.bones[name].quaternion)));dispose(a,b,source);
 }finally{restore();}
});

test('hidden animation advances its clock and skips pose work; re-entry samples a current valid pose',async()=>{
 const restore=mockCanvas();try{const source=await sourceAsset('football-auto.glb'),model=createFootballPlayer({source,number:5}),p={vx:0,vy:-6,kick:0,dive:0,tackle:0},state={freeze:0,events:[],controlled:0},before=model.userData.bones.RightUpLeg.quaternion.clone(),clock=model.userData.motionTime;
 for(let i=0;i<60;i++)animateFootballPlayer(model,p,state,'home',0,1/30,false);assert(model.userData.motionTime>clock+1);assert(model.userData.bones.RightUpLeg.quaternion.equals(before));animateFootballPlayer(model,p,state,'home',0,1/30,true,true);assert(!model.userData.bones.RightUpLeg.quaternion.equals(before));assert(Object.values(model.userData.bones).every(b=>Math.abs(b.quaternion.length()-1)<1e-5));dispose(model,source);
 }finally{restore();}
});

test('only visible players and moving effects update their matrices; static and hidden branches retain cached transforms',()=>{
 const scene=new THREE.Scene(),stand=new THREE.Group(),visible=new THREE.Group(),hidden=new THREE.Group(),ball=new THREE.Mesh(new THREE.SphereGeometry(.2),new THREE.MeshBasicMaterial());stand.position.x=20;scene.add(stand,visible,hidden,ball);scene.updateMatrixWorld(true);hidden.visible=false;
 let standCalls=0,hiddenCalls=0;stand.updateMatrixWorld=()=>standCalls++;hidden.updateMatrixWorld=()=>hiddenCalls++;visible.position.set(3,0,7);ball.position.set(4,.2,8);updateMatchWorld({home:[visible],away:[hidden]},[ball]);assert.equal(standCalls,0);assert.equal(hiddenCalls,0);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(visible.matrixWorld).toArray(),[3,0,7]);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(ball.matrixWorld).toArray(),[4,.2,8]);assert.equal(stand.matrixWorld.elements[12],20);dispose(scene);
});

test('frame pacing sustains the target under uneven screen callbacks and skips missed draws after stalls',()=>{
 for(const hz of[30,60]){const due=createMatchFramePacer(hz);let time=0,draws=0;for(let i=0;time<60000;i++){if(due(time))draws++;time+=[16,16,16,17][i%4];}assert(Math.abs(draws-hz*60)<3,`${hz}: ${draws}`);assert(due(time+2000));assert(!due(time+2000));assert(!due(time+2001));assert(due(time+2002,true));assert(due(0),'clock reset');assert(!due(NaN));}
});

test('animated human bounds remain conservative and culling keeps partial bodies at the edge of the frame',async()=>{
 const restore=mockCanvas();try{const source=await sourceAsset('football-auto.glb'),model=createFootballPlayer({source,number:4}),bounds=new THREE.Sphere(new THREE.Vector3(),2.8),p={vx:0,vy:-6,kick:0,dive:0,tackle:0},state={freeze:0,events:[],controlled:0};
 for(let i=0;i<90;i++){p.kick=i<30?i%12:0;p.dive=i>=30&&i<60?10-i%10:0;p.diveX=1;p.actionDuration=16;p.tackle=i>=60?5:0;animateFootballPlayer(model,p,state,'home',0,1/30);model.updateMatrixWorld(true);for(const mesh of meshes(model)){const n=mesh.geometry.attributes.position.count;for(let v=0;v<n;v+=Math.max(1,Math.floor(n/30))){const point=mesh.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);assert(point.distanceTo(new THREE.Vector3(0,1,0))<2.8,'culling sphere must contain the animated human');}}}
 const camera=new THREE.PerspectiveCamera(42,2,.5,200);camera.position.set(0,1,20);camera.lookAt(0,1,0);camera.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const point=new THREE.Vector3();let fullyOutside=0,partiallyVisible=0;for(let x=-30;x<=30;x++){point.set(x,0,0);const centerInside=frustum.containsPoint(new THREE.Vector3(x,1,0)),visible=playerInFrame(frustum,point,bounds);if(centerInside)assert(visible);if(!centerInside&&visible)partiallyVisible++;if(!visible)fullyOutside++;}assert(fullyOutside>0);assert(partiallyVisible>0);dispose(model,source);
 }finally{restore();}
});
