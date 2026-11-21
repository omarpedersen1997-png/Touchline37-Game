import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Object3D,Quaternion,Vector3} from 'three';
import {SIZE_POLICY,assessClientSize} from '../dev/size-policy.mjs';
import {samplePlayerPose,createPlayerResponse} from '../src/match-player-pose.js';
import {createBallRoll} from '../src/ball-roll.js';
import {createArcade} from '../shared/arcade.js';
import {safeMatchPrediction} from '../src/match-prediction.js';
import {livingCameraPlan,createLivingCameraRig} from '../src/living-camera.js';
const player=()=>({x:0,y:0,vx:0,vy:-6,ax:0,ay:-4,facingX:0,facingY:-1});

test('APK and total match code may grow beyond 5MB without a hard stop; startup and host remain guarded',()=>{
 assert.equal(SIZE_POLICY.apk.hardLimitBytes,null);assert.equal(SIZE_POLICY.allJavaScript.hardLimitBytes,null);
 for(const apkBytes of [5_000_001,25*1024*1024,80*1024*1024]){
  const check=assessClientSize({apkBytes,allJavaScriptBytes:8_000_000,initialJavaScriptBytes:950_000});
  assert.deepEqual(check.errors,[]);assert(check.warnings.some(w=>w.key==='allJavaScript'));
  assert.equal(check.warnings.some(w=>w.key==='apk'),apkBytes>=SIZE_POLICY.apk.reviewAtBytes);
 }
 assert.equal(assessClientSize({initialJavaScriptBytes:1_200_000}).errors[0].reason,'startup-work');
 assert.equal(assessClientSize({apkBytes:-1}).errors[0].reason,'invalid-size');
 assert.equal(SIZE_POLICY.worker.failAtBytes,9_400_000);
});
test('Motor11 R3 rules stay byte frozen while presentation and size policy evolve',()=>{
 assert.equal(createHash('sha256').update(readFileSync('shared/football-engine11-r3.js')).digest('hex'),'274b4d45a4fae126f62e3e9d79f7c76e9bc8eca0aa6d59fcfcc1203961fe1e10');
});
test('player subticks interpolate bounded heading through the short arc without modifying simulation or allocating output',()=>{
 const p={...player(),vx:6,vy:0,facingY:-1},saved=structuredClone(p),out={};
 for(const phase of [0,1/120,1/60,.03,.045]){assert.equal(samplePlayerPose(p,phase,out),out);assert(Math.abs(out.angle-Math.PI)<=4.5*phase+1e-12);assert.equal(out.x,6*phase);}
 const edge={...p,facingX:Math.sin(-Math.PI+.02),facingY:Math.cos(-Math.PI+.02),vx:Math.sin(Math.PI-.02)*6,vy:Math.cos(Math.PI-.02)*6};
 assert(Math.abs(samplePlayerPose(edge,.04).angle-(-Math.PI+.02))<.041);
 assert.deepEqual(p,saved);assert.deepEqual(samplePlayerPose(p,99),samplePlayerPose(p,.045));
});
test('acceleration/banking response is bounded, frame-rate independent and settles after braking',()=>{
 const p={...player(),ax:12,ay:-8},ends=[];
 for(const hz of [30,60,120]){const response=createPlayerResponse();let pose;for(let i=0;i<hz;i++)pose=response.update(p,1/hz);ends.push({...pose});assert(pose.forward<=.1&&Math.abs(pose.side)<=.11);for(let i=0;i<hz;i++)pose=response.update({...p,ax:0,ay:0},1/hz);assert(Math.abs(pose.forward)<1e-5&&Math.abs(pose.side)<1e-5);}
 for(const pose of ends)for(const key of ['forward','side'])assert(Math.abs(pose[key]-ends[0][key])<1e-12);
 const response=createPlayerResponse();assert.deepEqual(response.update(p,.02,{disabled:true,snap:true}),{forward:0,side:0});
});
test('grounded ball rolls by real travel at 30/60/120Hz and ignores restart teleports or paused frames',()=>{
 const axis=new Vector3(0,0,-1),distance=1.2,expected=new Quaternion().setFromAxisAngle(axis,distance/.22),ball={vx:distance,vy:0,vz:0};
 for(const hz of [30,60,120]){const mesh=new Object3D(),roll=createBallRoll();roll.update(mesh,{x:0,y:0,z:.22},ball,0);for(let i=1;i<=hz;i++)roll.update(mesh,{x:distance*i/hz,y:0,z:.22},ball,1/hz);assert(mesh.quaternion.angleTo(expected)<1e-6);const before=mesh.quaternion.clone();roll.update(mesh,{x:48,y:10,z:.22},ball,1/hz,{reset:true});roll.update(mesh,{x:49,y:10,z:.22},ball,1/hz,{paused:true});assert(mesh.quaternion.equals(before));}
});
test('resolved owned R3 receptions animate between ticks; loose impacts, legacy revisions and unresolved opponents stay guarded',()=>{
 const s=createArcade('touch53',{matchVersion:11,engineRevision:3});s.freeze=0;s.tick=100;
 for(const team of ['home','away'])for(const p of s[team])Object.assign(p,{x:25,y:35,vx:0,vy:0});
 Object.assign(s.ball,{x:0,y:0,z:.22,vx:5,vy:0,vz:0,owner:{team:'home',index:6}});s.lastContact={tick:100,kind:'touch',team:'home',index:6};
 const before=structuredClone(s);assert.equal(safeMatchPrediction(s,.04),.04);assert.deepEqual(s,before);
 s.engineRevision=2;assert.equal(safeMatchPrediction(s,.04),0);s.engineRevision=3;s.ball.owner=null;assert.equal(safeMatchPrediction(s,.04),0);
 s.ball.owner={team:'home',index:6};s.lastContact.kind='save';assert.equal(safeMatchPrediction(s,.04),0);s.lastContact.kind='touch';Object.assign(s.away[3],{x:.1,y:0});assert.equal(safeMatchPrediction(s,.04),0);
});
test('camera uses displayed ball/player subticks without mutating state, retains reduced motion and resets cleanly at kickoff',()=>{
 const s=createArcade('camera53',{matchVersion:11,engineRevision:3});s.freeze=0;s.openingKickoff=null;s.ball.x=2;s.ball.vx=6;s.home[s.controlled].x=2;s.home[s.controlled].vx=6;
 const before=structuredClone(s),base=livingCameraPlan(s,2),sample=livingCameraPlan(s,2,{ballPosition:{x:2.2,y:s.ball.y,z:s.ball.z},playerPosition:{x:2.2,y:s.ball.y}});
 assert(Math.abs(sample.target[0]-base.target[0]-.2)<1e-9);assert.deepEqual(s,before);
 const rig=createLivingCameraRig();rig.update(base,0);rig.update(sample,.04);const reset=rig.update(base,.04,{snap:true});assert.deepEqual(reset.eye,base.eye);assert.deepEqual(reset.target,base.target);
 s.freeze=24;s.openingKickoff='home';assert.deepEqual(livingCameraPlan(s,2,{ballPosition:{x:20,y:20,z:4}}).target,[0,.8,0]);
 const reduced=livingCameraPlan(before,2,{reducedMotion:true});assert(reduced.eye.every(Number.isFinite));
});
