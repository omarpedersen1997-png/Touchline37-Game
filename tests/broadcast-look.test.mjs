import {test} from 'node:test';
import {chalkCoverage,createBroadcastChalk} from '../src/broadcast-chalk.js';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {livingCameraPlan,createLivingCameraRig} from '../src/living-camera.js';
import {matchCamera,BROADCAST_OFFSET,screenToPitch} from '../src/match-camera.js';
import {createArcade} from '../shared/arcade.js';
import {createBroadcastPitch,pitchSurfaceSample} from '../src/broadcast-pitch.js';
import {createBroadcastShadows} from '../src/broadcast-shadows.js';
import {broadcastSurfaceMaterial} from '../src/broadcast-surfaces.js';

const config={matchVersion:11,engineRevision:3,homeRating:65,awayRating:62},field={width:60,length:96,goalWidth:8,goalHeight:2.4};
function origin(){const s=createArcade('close58',config);s.freeze=0;s.openingKickoff=null;Object.assign(s.ball,{x:0,y:0,z:.22,vx:0,vy:0});Object.assign(s.home[s.controlled],{x:0,y:0});return s;}
function projectedHeight(plan,width,height){const camera=new THREE.PerspectiveCamera(plan.fov,width/height,.1,800);camera.position.set(...plan.eye);camera.lookAt(new THREE.Vector3(...plan.target));camera.updateMatrixWorld();const foot=new THREE.Vector3(0,.03,0).project(camera),head=new THREE.Vector3(0,1.83,0).project(camera);return Math.abs(head.y-foot.y)*height/2;}

test('broadcast figures project substantially larger than TEST57 at the same resolution, with legacy R2 lens intact',()=>{
 const s=origin(),rows=[];
 for(const [width,height] of [[915,412],[1280,576],[390,844],[320,640]]){
  const fit=Math.max(1,1.2/Math.max(.5,width/height)),old={eye:[40*.72*fit,15.5*fit,12*.72*fit],target:[0,.8,0],fov:44};
  const plan=matchCamera(s,'broadcast',width/height),before=projectedHeight(old,width,height),after=projectedHeight(plan,width,height);
  assert(after/before>(width>height?1.55:2.2));assert(after/before<3);rows.push({width,height,beforePixels:before,afterPixels:after,ratio:after/before});
  const legacy=matchCamera({...s,engineRevision:2},'broadcast',width/height);assert.deepEqual(legacy.target,old.target);assert.equal(legacy.fov,old.fov);legacy.eye.forEach((n,i)=>assert(Math.abs(n-old.eye[i])<1e-10));
  assert(Math.abs((plan.eye[0]-plan.target[0])/(plan.eye[2]-plan.target[2])-BROADCAST_OFFSET.x/BROADCAST_OFFSET.z)<1e-10);
 }
 console.log(JSON.stringify({projectionComparison:rows,source:'geometric projection, not FPS or physical phone measurement'}));
});

test('close framing keeps the ball in view at touchlines, goal lines and loft heights across portrait and landscape',()=>{
 const s=origin();s.ball.owner=null;
 for(const aspect of [.5,390/844,915/412,1280/576])for(const x of [-29,0,29])for(const y of [-46,0,46])for(const z of [.22,4,10]){
  Object.assign(s.ball,{x,y,z,vx:15,vy:-15});Object.assign(s.home[s.controlled],{x,y});
  const plan=matchCamera(s,'broadcast',aspect),camera=new THREE.PerspectiveCamera(plan.fov,aspect,.1,800);camera.position.set(...plan.eye);camera.lookAt(new THREE.Vector3(...plan.target));camera.updateMatrixWorld();const point=new THREE.Vector3(x,z,y).project(camera);
  assert(Math.abs(point.x)<.85&&Math.abs(point.y)<.8,`ball outside usable lens: ${aspect} ${x},${y},${z}: ${point.toArray()}`);
 }
});

test('the closer rig retains centred kickoff, bounded refit, stable reduced motion and exact control heading',()=>{
 const s=origin(),base=matchCamera(s,'broadcast',2.2);s.ball.owner=null;Object.assign(s.ball,{vx:32,vy:16,z:4});const moving=matchCamera(s,'broadcast',2.2);
 assert(moving.eye[1]<=base.eye[1]*1.081);const reduced=matchCamera(s,'broadcast',2.2,{reducedMotion:true});assert.equal(reduced.eye[1],base.eye[1]);assert.equal(reduced.target[1],.8);
 s.freeze=20;s.openingKickoff={};assert.deepEqual(matchCamera(s,'broadcast',2.2).target,[0,.8,0]);
 const expected={x:12/Math.hypot(40,12),y:-40/Math.hypot(40,12)};assert.deepEqual(screenToPitch(1,0,'broadcast'),expected);
 for(const hz of [60,120]){const rig=createLivingCameraRig();rig.update(base,0);let pose;for(let i=0;i<hz;i++)pose=rig.update(moving,1/hz);assert(pose.eye.every(Number.isFinite));const reset=rig.update(base,.016,{snap:true});assert.deepEqual(reset.eye,base.eye);}
});

test('continuous grass is one bounded static mesh with world-scale textures and no mutation of source maps',()=>{
 const textures=Object.fromEntries(['color','normal','roughness'].map(name=>[name,new THREE.Texture()])),pitch=createBroadcastPitch(field,textures);
 assert(pitch.isMesh&&pitch.material.isMeshStandardMaterial&&pitch.material.vertexColors);assert.equal(pitch.children.length,0);assert(!pitch.onBeforeRender.toString().includes('requestAnimationFrame'));
 assert(pitch.geometry.index.count/3<4000);assert.equal(pitch.position.y,.03);
 for(const name of ['map','normalMap','roughnessMap']){const t=pitch.material[name];assert.equal(t.repeat.x,10);assert.equal(t.repeat.y,16);assert(!Object.values(textures).includes(t));}
 for(const texture of Object.values(textures))assert.deepEqual(texture.repeat.toArray(),[1,1]);
 for(const n of pitch.geometry.attributes.color.array)assert(Number.isFinite(n)&&n>0&&n<=1);
 const box=new THREE.Box3().setFromObject(pitch);assert(Math.abs(box.min.x+30)<1e-6&&Math.abs(box.max.z-48)<1e-6);assert(Math.abs(box.min.y-.03)<1e-6);
 pitch.geometry.dispose();pitch.material.dispose();
});

test('mowing bands retain visible contrast, with smooth deterministic wear concentrated at real goal mouths',()=>{
 const a=pitchSurfaceSample(10,0,field),b=pitchSurfaceSample(10,8,field);assert(a.band-b.band>.8);
 assert(pitchSurfaceSample(0,48,field).wear>pitchSurfaceSample(20,30,field).wear+.1);
 assert(pitchSurfaceSample(0,0,field).wear>pitchSurfaceSample(20,0,field).wear);
 const before=pitchSurfaceSample(8,7,field);for(let i=0;i<100;i++)assert.deepEqual(pitchSurfaceSample(8,7,field),before);
 const left=pitchSurfaceSample(0,3.99,field),right=pitchSurfaceSample(0,4.01,field);assert(Math.abs(left.band-right.band)<.02);
});

test('foot/body/head and static goal shadows share one submission, follow displayed figures and do not mutate models',()=>{
 const scene=new THREE.Scene(),shadows=createBroadcastShadows(scene,field,11);assert.equal(scene.children.length,1);assert(shadows.mesh.isInstancedMesh);assert.equal(shadows.mesh.count,72);assert(!shadows.mesh.castShadow);
 const strengths=shadows.mesh.geometry.attributes.shadowStrength;assert(strengths.isInstancedBufferAttribute);for(const x of strengths.array)assert(x>0&&x<=1);
 const models={home:[],away:[]};for(const team of ['home','away'])for(let i=0;i<11;i++){const p=new THREE.Object3D();p.position.set(i,0,team==='home'?4:-4);models[team].push(p);}
 const positions=models.home.map(m=>m.position.toArray()),matrix=new THREE.Matrix4();shadows.mesh.getMatrixAt(66,matrix);const goal=matrix.clone();shadows.update(models);shadows.mesh.getMatrixAt(22,matrix);assert(matrix.elements[12]>models.home[0].position.x);assert(matrix.elements[14]<models.home[0].position.z);
 models.home[0].position.set(3,.5,5);shadows.update(models);shadows.mesh.getMatrixAt(22,matrix);assert(matrix.elements[12]>3);assert(matrix.elements.every(Number.isFinite));shadows.mesh.getMatrixAt(66,matrix);assert(matrix.equals(goal));
 for(let i=1;i<11;i++)assert.deepEqual(models.home[i].position.toArray(),positions[i]);
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};shadows.mesh.material.onBeforeCompile(shader);assert(shader.vertexShader.includes('attribute float shadowStrength'));assert(shader.fragmentShader.includes('diffuseColor.a *= vShadowStrength'));
 shadows.mesh.geometry.dispose();shadows.mesh.material.map.dispose();shadows.mesh.material.dispose();shadows.mesh.dispose();
});

test('goal, net and stadium grading clones materials while preserving their maps and original library',()=>{
 for(const name of ['Goal powder coat','Woven goal net','Concrete aggregate','Brushed steel','Stadium navy']){
  const source=new THREE.MeshStandardMaterial({color:0x808080,map:new THREE.Texture(),roughness:.7,metalness:.3});source.name=name;const before=source.color.getHex(),m=broadcastSurfaceMaterial(source);
  assert(m!==source);assert.equal(m.map,source.map);assert.equal(source.color.getHex(),before);assert.equal(source.roughness,.7);
  if(name==='Woven goal net'){assert(m.transparent&&m.forceSinglePass&&!m.depthWrite);assert(m.opacity<1);}
  if(name==='Goal powder coat'){assert(m.color.r>source.color.r);assert(m.metalness<source.metalness);}
  m.dispose();source.map.dispose();source.dispose();
 }
});

test('visual revision leaves frozen R2/R3 rules and original binary asset manifest intact',()=>{
 for(const [file,expected] of [['shared/football-engine11-r2.js','4ad518a8d5fe454a76cbca4345f0f2294a1b6e7fddb3f98c9d17dad47d6d6f42'],['shared/football-engine11-r3.js','274b4d45a4fae126f62e3e9d79f7c76e9bc8eca0aa6d59fcfcc1203961fe1e10']])assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),expected);
 for(const item of JSON.parse(readFileSync('public/match-assets55/manifest.json')).files)assert.equal(createHash('sha256').update(readFileSync('public/match-assets55/'+item.file)).digest('hex'),item.sha256);
});


test('analytic chalk preserves subpixel coverage instead of binary gaps, with one transparent material pass',()=>{
 assert.equal(chalkCoverage(0,.1),1);assert.equal(chalkCoverage(1,.1),0);assert.equal(chalkCoverage(0,2),.25);
 // Integral coverage of a .5-unit line remains .5 even if it moves across
 // the pixel grid: no alternating all-white/all-missing distant segments.
 for(const shift of [0,.1,.3,.7]){let total=0;for(let pixel=-4;pixel<=4;pixel++)total+=chalkCoverage(pixel+shift,1);assert(Math.abs(total-.5)<1e-10);}
 const m=createBroadcastChalk();assert(m.transparent&&m.forceSinglePass&&!m.depthWrite);
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};m.onBeforeCompile(shader);assert(shader.vertexShader.includes('attribute float chalkEdge'));assert(shader.fragmentShader.includes('fwidth(vChalkEdge)'));m.dispose();
});
