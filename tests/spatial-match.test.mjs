import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {footballBodyProfile,keeperDivePose,createKeeperReadiness} from '../src/football-body-profile.js';
import {ballSurfacePose,playerContactShadow} from '../src/match-ball-surface.js';
import {safeMatchPrediction} from '../src/match-prediction.js';
import {goalBallPosition} from '../src/goal-presentation.js';
import {livingCameraPlan} from '../src/living-camera.js';
import {createBallRoll} from '../src/ball-roll.js';
import {createFootballPlayer,animateFootballPlayer} from '../src/pro-player.js';
import {copyPlayerPose} from '../src/player-rendering.js';
import {createArcade} from '../shared/arcade.js';
import {MATCH_LIGHTING} from '../src/match-lighting.js';

const config={matchVersion:11,engineRevision:3,homeRating:65,awayRating:62,formation:'4-3-3'};
function fieldState(){
 const s=createArcade('spatial57',config);s.freeze=0;s.openingKickoff=null;s.tick=100;
 for(const team of ['home','away'])for(const p of s[team])Object.assign(p,{x:26,y:35,vx:0,vy:0});
 Object.assign(s.ball,{owner:null,x:0,y:0,z:.22,vx:30,vy:0,vz:0,curl:0,lastTouch:{team:'home',index:6},lastTouchTick:90,flightKind:'pass'});
 s.lastContact=null;return s;
}

test('R3 partial prediction advances to the earliest unresolved body without crossing it or changing simulation',()=>{
 const s=fieldState();Object.assign(s.away[2],{x:2,y:0});
 const saved=structuredClone(s),full=.045,horizon=safeMatchPrediction(s,full,{continuous:true});
 assert(horizon>0&&horizon<full);assert.equal(safeMatchPrediction(s,full),0);
 const point=goalBallPosition(s,horizon);assert(point.x<.9&&point.x>.75);
 // A closer player must win regardless of array/team iteration order.
 Object.assign(s.away[7],{x:1.5,y:0});assert(safeMatchPrediction(s,full,{continuous:true})<horizon);
 Object.assign(s.away[7],saved.away[7]);assert.deepEqual(s,saved);
 s.engineRevision=2;assert.equal(safeMatchPrediction(s,full,{continuous:true}),0);
});

test('only a confirmed post-contact velocity releases the old 150ms visual hold, with nearby receivers still protected',()=>{
 const s=fieldState();s.lastContact={tick:100,kind:'save',team:'away',index:0};s.ball.lastTouch={team:'away',index:0};s.ball.lastTouchTick=100;
 assert.equal(safeMatchPrediction(s,.04),0);assert.equal(safeMatchPrediction(s,.04,{continuous:true}),.04);
 s.ball.lastTouchTick=99;assert.equal(safeMatchPrediction(s,.04,{continuous:true}),0);
 s.ball.lastTouchTick=100;Object.assign(s.home[3],{x:.7,y:0});assert.equal(safeMatchPrediction(s,.04,{continuous:true}),0);
});

test('flight profiles, rebounds and first-touch states are sampled faithfully without mutating a frozen R3 recording',()=>{
 const distance={};
 for(const kind of ['pass','through','loft','shot','loose']){
  const s=fieldState();Object.assign(s.ball,{flightKind:kind,z:kind==='loft'?2:.22,vz:kind==='loft'?5:0});
  const before=structuredClone(s),points=[0,.008,.016,.024,.032,.04].map(t=>goalBallPosition(s,safeMatchPrediction(s,t,{continuous:true})));
  for(let i=1;i<points.length;i++){assert(points[i].x>points[i-1].x);assert(points[i].x-points[i-1].x<.25);}
  distance[kind]=points.at(-1).x;assert.deepEqual(s,before);
 }
 assert(distance.through>distance.pass);assert(distance.shot>distance.pass);
 const s=fieldState();s.ball.z=.24;s.ball.vz=-4;
 const bounce=goalBallPosition(s,.04);assert.equal(bounce.z,.22);assert(bounce.vz>0);
 s.ball.owner={team:'home',index:6};s.ball.vx=3;s.ball.vz=.4;
 const receive=goalBallPosition(s,.04);assert.equal(receive.x,.12);assert.equal(receive.z,.256);
});

test('one centre-to-surface mapping grounds every displayed ball radius and weakens the projected airborne shadow',()=>{
 for(const radius of [.1254,.19,.25]){
  const ground=ballSurfacePose({x:3,y:-5,z:.22},radius),air=ballSurfacePose({x:3,y:-5,z:4.22},radius);
  assert(Math.abs(ground.z-radius-.03)<1e-12);assert(Math.abs(air.z-ground.z-4)<1e-12);
  assert(air.shadowScale>ground.shadowScale);assert(air.shadowOpacity<ground.shadowOpacity);assert(air.shadowOpacity>=.07);
 }
 const p={dive:0},shadow=playerContactShadow(p,1);assert(shadow.width>shadow.depth);assert.equal(shadow.angle,.72);
 p.dive=5;assert(playerContactShadow(p,1).width>shadow.width);
});

test('rotation follows displayed circumference and held frames never accumulate ball spin',()=>{
 const object=new THREE.Object3D(),roll=createBallRoll(),b={vx:1,vy:0,vz:0};
 roll.update(object,{x:0,y:0,z:.22},b,.02,{radius:.125});roll.update(object,{x:.1,y:0,z:.22},b,.02,{radius:.125});
 assert(Math.abs(object.quaternion.angleTo(new THREE.Quaternion())-.8)<1e-8);
 const saved=object.quaternion.clone();roll.update(object,{x:.2,y:0,z:.22},b,.02,{paused:true,radius:.125});assert(object.quaternion.equals(saved));
 roll.reset();roll.update(object,{x:30,y:0,z:.22},b,.02);assert(object.quaternion.equals(saved));
});

test('the lens frames the displayed loft height and retains fixed heading, bounded zoom, reduced motion and centre kickoff',()=>{
 const s=fieldState();Object.assign(s.home[s.controlled],{x:0,y:0});
 const low=livingCameraPlan(s,2,{ballPosition:{x:0,y:0,z:.2}}),high=livingCameraPlan(s,2,{ballPosition:{x:0,y:0,z:7}});
 assert(high.target[1]>low.target[1]);assert(high.target[1]<=4);assert(high.eye[1]<=low.eye[1]*1.081);
 assert.equal(livingCameraPlan(s,2,{reducedMotion:true,ballPosition:{x:0,y:0,z:7}}).target[1],.8);
 s.openingKickoff={};s.freeze=20;assert.deepEqual(livingCameraPlan(s,2).target,[0,.8,0]);
 assert(MATCH_LIGHTING.ambient<1.8);assert(MATCH_LIGHTING.rimIntensity<1);assert(MATCH_LIGHTING.keyIntensity>2.2);
});

test('keepers brace only for live danger and release the pose smoothly at the same rate across refresh frequencies',()=>{
 const s=fieldState(),p={x:0,y:20,vx:0,vy:0,dive:0,kick:0,tackle:0};Object.assign(s.ball,{x:0,y:10,vy:20,shot:true});
 const weights=[];for(const hz of [30,60,120]){const rig=createKeeperReadiness();let w;for(let i=0;i<hz;i++)w=rig.update(p,s,'home',1/hz);weights.push(w);assert(w>.6&&w<.7);}
 assert(Math.max(...weights)-Math.min(...weights)<1e-10);
 const rig=createKeeperReadiness();assert(rig.update(p,s,'home',0,{snap:true})>.6);s.freeze=20;assert(rig.update(p,s,'home',1)>.3);for(let i=0;i<60;i++)rig.update(p,s,'home',1/60);assert(rig.update(p,s,'home',0)<1e-5);
});

test('pelvis-centred dives mirror through both playing directions and use their own ten-tick duration',()=>{
 for(const heading of [0,Math.PI]){
  const a=keeperDivePose({dive:5,actionDuration:10,diveX:1,diveY:0},heading),b=keeperDivePose({dive:5,actionDuration:10,diveX:-1,diveY:0},heading);
  assert.equal(a.progress,.5);assert(a.height>.8);assert(Math.abs(a.height-b.height)<1e-12);assert(Math.abs(a.x+b.x)<1e-12);assert(a.x<0&&b.x>0);
  assert.equal(keeperDivePose({dive:10,actionDuration:10,diveX:1},heading).height,0);
  assert(keeperDivePose({dive:5,actionDuration:10,diveX:1},heading,.02).progress>.5);
 }
});

async function richModel(name){
 const input=readFileSync(new URL('../public/match-assets55/'+name,import.meta.url)),n=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+n));
 for(const m of json.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.extensions;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}
 const j=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]),bin=input.subarray(20+n),out=Buffer.alloc(20+padded.length+bin.length);
 input.copy(out,0,0,12);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);bin.copy(out,20+padded.length);
 const gltf=await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');gltf.scene.userData.richPack=true;gltf.scene.animations=gltf.animations;return gltf.scene;
}

test('actual rich rigs gain athletic proportions, retain grounded soles and carry printed numbers with their chest through turns and shots',async()=>{
 const prior={self:globalThis.self,document:globalThis.document};globalThis.self=globalThis;globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
 try{for(const name of ['player-auto.glb','keeper-auto.glb']){
  const source=await richModel(name),keeper=name.startsWith('keeper'),model=createFootballPlayer({source,number:8,keeper,optimize:false,emblemMap:new THREE.Texture()}),d=model.userData,profile=footballBodyProfile(8,keeper);
  assert.equal(d.human.scale.x,profile.width);assert(keeper ? profile.width>=1.14&&profile.width<=1.2 : profile.width>=1.06&&profile.width<=1.12);assert.equal(d.jersey.parent,d.bones.Spine2);
  const local=d.jersey.matrix.clone(),p={x:0,y:0,vx:0,vy:5,ax:8,ay:2,facingX:0,facingY:1,kick:0,dive:0,tackle:0},s=fieldState(),point=new THREE.Vector3();let sole;model.traverse(o=>{if(o.material?.name==='Sneaker outsole')sole=o;});assert(sole);
  for(let frame=0;frame<120;frame++){
   p.x+=p.vx/120;p.y+=p.vy/120;model.position.set(p.x,0,p.y);model.rotation.y=Math.min(Math.PI,frame/60);
   if(frame>60){p.action='kick';p.actionDuration=10;p.kick=Math.max(1,10-Math.floor((frame-60)/6));}
   animateFootballPlayer(model,p,s,'home',s.controlled,1/120,true,frame===0,.02);model.updateMatrixWorld(true);
   assert(d.jersey.matrix.equals(local),'decal rest transform stays bound to chest');
   let floor=Infinity;if(frame%12===0){for(let i=0;i<sole.geometry.attributes.position.count;i++){sole.getVertexPosition(i,point).applyMatrix4(sole.matrixWorld);floor=Math.min(floor,point.y);}assert(floor>.008&&floor<.055,`${name} floor ${floor}`);}
  }
  const other=createFootballPlayer({source,number:8,keeper});copyPlayerPose(model,other);assert(other.userData.human.quaternion.angleTo(d.human.quaternion)<1e-7);
 }}finally{Object.assign(globalThis,prior);}
});

test('actual keeper dive geometry stays finite and above the turf through mirrored ten-tick dives',async()=>{
 const prior={self:globalThis.self,document:globalThis.document};globalThis.self=globalThis;globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
 try{
  const source=await richModel('keeper-auto.glb'),model=createFootballPlayer({source,keeper:true,optimize:false}),p={x:0,y:0,vx:0,vy:0,facingX:0,facingY:1,action:'dive',actionDuration:10,dive:10,diveX:1,diveY:0,kick:0,tackle:0},s=fieldState(),point=new THREE.Vector3();
  for(const heading of [0,Math.PI])for(const side of [-1,1])for(let frame=0;frame<30;frame++){
   const time=frame/60,ticks=time*20;p.dive=10-Math.floor(ticks);p.diveX=side;model.position.set(0,0,0);model.rotation.set(0,heading,0);
   animateFootballPlayer(model,p,s,'home',0,1/60,true,frame===0,(ticks%1)*.05);model.updateMatrixWorld(true);
   let floor=Infinity;model.userData.human.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const n=mesh.geometry.attributes.position.count;for(let i=0;i<n;i+=7){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);assert(point.toArray().every(Number.isFinite));floor=Math.min(floor,point.y);}});
   assert(floor>-.04,`heading${heading} side${side} frame${frame} below turf ${floor}`);
   if(frame===15){
    const head=model.userData.bones.Head.getWorldPosition(new THREE.Vector3());
    for(const hand of ['LeftHand','RightHand']){const point=model.userData.bones[hand].getWorldPosition(new THREE.Vector3());assert((point.x-head.x)*side>.1,`${hand} must reach towards the save, heading${heading} side${side}`);}
   }
  }
 }finally{Object.assign(globalThis,prior);}
});

test('broader rich bodies retain low ground-relative boot drift at running and sprinting pace',async()=>{
 const prior={self:globalThis.self,document:globalThis.document};globalThis.self=globalThis;globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
 try{
  const source=await richModel('player-auto.glb');
  for(const speed of [6,8]){
   const model=createFootballPlayer({source,number:8,optimize:false}),p={x:0,y:0,vx:0,vy:-speed,facingX:0,facingY:-1,kick:0,dive:0,tackle:0},s=fieldState(),drift=[];let previous;
   for(let frame=0;frame<600;frame++){
    p.y-=speed/120;model.position.set(0,0,p.y);model.rotation.y=Math.PI;animateFootballPlayer(model,p,s,'home',0,1/120,true,frame===0);model.updateMatrixWorld(true);
    const feet=['LeftFoot','RightFoot'].map(n=>model.userData.bones[n].getWorldPosition(new THREE.Vector3()));
    if(previous&&frame>50)for(let i=0;i<2;i++)if(feet[i].y<.18&&previous[i].y<.18&&feet[i].y<feet[1-i].y-.08)drift.push(Math.abs(feet[i].z-previous[i].z)*120);
    previous=feet;
   }
   drift.sort((a,b)=>a-b);assert(drift.length>100);const median=drift[drift.length>>1];console.log(JSON.stringify({richBootSpeed:speed,medianDrift:median}));assert(median<.9,`${speed}m/s planted boot drift ${median}`);
  }
 }finally{Object.assign(globalThis,prior);}
});
