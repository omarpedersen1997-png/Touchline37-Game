import{test}from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import * as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{createFootballPlayer,animateFootballPlayer}from'../src/pro-player.js';

async function asset(name){
 const input=readFileSync(new URL('../assets/game/'+name,import.meta.url)),length=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+length));
 for(const material of json.materials){delete material.normalTexture;delete material.occlusionTexture;delete material.emissiveTexture;delete material.extensions;delete material.pbrMetallicRoughness?.baseColorTexture;delete material.pbrMetallicRoughness?.metallicRoughnessTexture;}
 const text=Buffer.from(JSON.stringify(json)),j=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),bin=input.subarray(20+length),output=Buffer.alloc(20+j.length+bin.length);input.copy(output,0,0,12);output.writeUInt32LE(output.length,8);output.writeUInt32LE(j.length,12);output.writeUInt32LE(0x4e4f534a,16);j.copy(output,20);bin.copy(output,20+j.length);
 return(await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'')).scene;
}
function setup(){const previous={document:globalThis.document,self:globalThis.self},ctx=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.self=globalThis;globalThis.document={createElement:()=>({getContext:()=>ctx})};return()=>Object.assign(globalThis,previous);}
function dispose(...roots){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();for(const root of roots)root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.isSkinnedMesh)skeletons.add(node.skeleton);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());textures.forEach(item=>item.dispose());skeletons.forEach(item=>item.dispose());}
const state={freeze:0,events:[],controlled:0};

test('actual boot soles remain on the pitch throughout idle, walk, run and their transitions in both shipped LODs',async()=>{
 const restore=setup();try{for(const name of['football-auto.glb','football-pro.glb']){
  const source=await asset(name),model=createFootballPlayer({source,number:8,optimize:false}),p={x:0,y:0,vx:0,vy:0,kick:0,dive:0,tackle:0},point=new THREE.Vector3();let sole;
  model.traverse(mesh=>{if(mesh.material?.name==='Sneaker outsole')sole=mesh;});assert(sole);assert(model.userData.grounding.supportCount>8&&model.userData.grounding.supportCount<40);
  for(let frame=0;frame<420;frame++){
   const speed=frame<60?0:frame<150?1.6:frame<300?6:frame<360?8:0;p.vy=-speed;p.y-=speed/60;model.position.z=p.y;model.rotation.y=Math.PI;animateFootballPlayer(model,p,state,'home',0,1/60);model.updateMatrixWorld(true);
   let floor=Infinity;for(let i=0;i<sole.geometry.attributes.position.count;i++){sole.getVertexPosition(i,point).applyMatrix4(sole.matrixWorld);floor=Math.min(floor,point.y);}
   assert(floor>.017&&floor<.047,`${name} frame${frame}: lowest actual outsole=${floor}`);
  }
  dispose(model,source);
 }}finally{restore();}
});

test('a planted running foot has low ground-relative drift at normal playing speed',async()=>{
 const restore=setup();try{
  const source=await asset('football-auto.glb'),model=createFootballPlayer({source,optimize:false}),p={x:0,y:0,vx:0,vy:-6,kick:0,dive:0,tackle:0},elapsed=1/120,drift=[];let previous;
  model.rotation.y=Math.PI;
  for(let frame=0;frame<600;frame++){
   p.y-=6*elapsed;model.position.z=p.y;animateFootballPlayer(model,p,state,'home',0,elapsed);model.updateMatrixWorld(true);
   const feet=['LeftFoot','RightFoot'].map(name=>model.userData.bones[name].getWorldPosition(new THREE.Vector3()));
   if(previous&&frame>50)for(let foot=0;foot<2;foot++)if(feet[foot].y<.18&&previous[foot].y<.18&&feet[foot].y<feet[1-foot].y-.08)drift.push(Math.abs(feet[foot].z-previous[foot].z)/elapsed);
   previous=feet;
  }
  drift.sort((a,b)=>a-b);assert(drift.length>150);assert(drift[drift.length>>1]<.9,`median planted-foot drift ${drift[drift.length>>1]}m/s`);dispose(model,source);
 }finally{restore();}
});

test('cadence follows rendered displacement and freezes during a held replay frame',async()=>{
 const restore=setup();try{
  const source=await asset('football-auto.glb'),model=createFootballPlayer({source}),p={x:0,y:0,vx:0,vy:-6,kick:0,dive:0,tackle:0};
  animateFootballPlayer(model,p,state,'home',0,1/60);const initial=model.userData.motionTime;
  for(let i=0;i<60;i++){p.y-=3/60;model.position.z=p.y;animateFootballPlayer(model,p,state,'home',0,1/60);}
  assert(Math.abs(model.userData.motionTime-initial-3/3.5)<.001,'body moves3m while simulation velocity reports6m/s');
  const held=model.userData.motionTime;model.position.z-=.1;animateFootballPlayer(model,p,state,'home',0,0);assert.equal(model.userData.motionTime,held);
  for(let i=0;i<30;i++)animateFootballPlayer(model,p,state,'home',0,1/60);assert.equal(model.userData.motionTime,held,'stopped rendered body does not cycle its feet');dispose(model,source);
 }finally{restore();}
});

test('goal celebrations keep real boots grounded, and approaching teammates continue to walk',async()=>{
 const restore=setup();try{
  const source=await asset('football-auto.glb'),model=createFootballPlayer({source,number:10,optimize:false}),p={x:0,y:0,vx:0,vy:0,kick:0,dive:0,tackle:0},point=new THREE.Vector3();let sole;
  model.traverse(mesh=>{if(mesh.material?.name==='Sneaker outsole')sole=mesh;});assert(sole);
  const goalState={version:10,tick:130,freeze:0,controlled:0,goalSequence:{stage:'celebration',team:'home',celebrants:[0]}};
  for(let frame=0;frame<150;frame++){
   animateFootballPlayer(model,p,goalState,'home',0,1/60);model.updateMatrixWorld(true);assert.equal(model.userData.motionClip,'cheer');
   let floor=Infinity;for(let i=0;i<sole.geometry.attributes.position.count;i++){sole.getVertexPosition(i,point).applyMatrix4(sole.matrixWorld);floor=Math.min(floor,point.y);}
   assert(floor>.017&&floor<.047,`celebration frame${frame}: actual sole=${floor}`);
  }
  p.vy=-1.4;p.y-=1.4/60;model.position.z=p.y;animateFootballPlayer(model,p,goalState,'home',0,1/60);assert.equal(model.userData.motionClip,'walk');
  goalState.goalSequence={stage:'kickoff',team:'home',celebrants:[0]};p.vy=0;animateFootballPlayer(model,p,goalState,'home',0,1/60);assert.equal(model.userData.motionClip,'idle');
  dispose(model,source);
 }finally{restore();}
});
