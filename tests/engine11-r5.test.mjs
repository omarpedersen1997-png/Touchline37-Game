import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, Texture } from 'three';
import * as r4 from '../shared/football-engine11-r4.js';
import * as r5 from '../shared/football-engine11-r5.js';
import { estimateGroundFlight, firstTouchError, redirectHeader, resolveShoulderMomentum, HIGH_PRESS_COMMAND, FREE_KICK_SHOT, FREE_KICK_PASS } from '../shared/football-r5-dynamics.js';
import { integrateMatchBall } from '../shared/football-motion-r4.js';
import { getArcadeRules } from '../shared/arcade.js';
import { createR4Practice } from '../src/r4-practice.js';
import { createManualSession } from '../src/manual-session.js';
import { applyFastMatchMaterials, takeMatchPose, usesFastMatchRender } from '../src/match-fast-render.js';
import { matchResolution } from '../src/match-quality.js';
import { createR4CameraPlan } from '../src/broadcast-r4.js';
import { screenToPitch } from '../src/match-camera.js';

test('R5 commands stay in the isolated revision and round trip with its own tape',()=>{
 const inputs=new Uint16Array(r5.INPUT_COUNT);
 inputs[1]=HIGH_PRESS_COMMAND;
 inputs[40]=FREE_KICK_SHOT;
 assert.deepEqual(r5.decodeInputs(r5.encodeInputs(inputs)),inputs);
 assert.throws(()=>r4.encodeInputs(inputs.subarray(0,r4.INPUT_COUNT)),/Ufuldstændigt/);
 assert.throws(()=>getArcadeRules(11,5),/revisionen understøttes ikke/);
 const game=r5.replayArcade('press',{surface:'wet'},inputs);
 assert.equal(game.period,'finished');
 assert.equal(game.tactic,'pressing');
 assert.equal(game.surface,'wet');
});

test('a complete R5 match has identical final state and replay with 60 and 120 Hz frame schedules',()=>{
 const simulations=[60,120].map(frequency=>{
  const practice=createR4Practice(1600,{revision:5,surface:'wet'});
  const session=createManualSession(practice.match,{storage:practice.storage,practiceRules:practice.rules,now:practice.match.started});
  const duration=practice.match.manual.duration;
  for(let i=1;i<=Math.ceil(duration*frequency/1000);i++){
   const time=Math.min(duration,i*1000/frequency);
   session.advance(practice.match.started+time,0,{maxInputs:4});
  }
  assert(session.complete);
  const input=r5.decodeInputs(session.packet());
  assert.equal(input.length,r5.INPUT_COUNT);
  assert.deepEqual(r5.replayArcade(practice.match.manual.seed,practice.match.manual.config,input),session.state);
  return {state:session.state,packet:session.packet()};
 });
 assert.deepEqual(simulations[0],simulations[1]);
});

test('wet ground skids farther and the analytical pass planner predicts actual roll time',()=>{
 const base={x:0,y:0,z:.22,vx:22,vy:0,vz:0,curl:0,flightKind:'pass'};
 const wet={...base,surface:'wet'},dry={...base,surface:'dry'};
 for(let i=0;i<20;i++){integrateMatchBall(wet);integrateMatchBall(dry);}
 assert(wet.x>dry.x && wet.vx>dry.vx);
 for(const surface of ['dry','wet'])for(const length of [3,10,27,37]){
  const ball={...base,surface},planned=estimateGroundFlight(length,ball.vx,'pass',surface);
  let elapsed=0;
  while(ball.x<length&&elapsed<4){integrateMatchBall(ball);elapsed+=.05;}
  assert(Math.abs(elapsed-planned.time)<.06,`${length} m · ${surface}`);
 }
});

test('shoulder contact transfers momentum only while closing, and body angle matters to the first touch',()=>{
 const a={vx:5,vy:1},b={vx:1,vy:1};
 assert(resolveShoulderMomentum(a,b,1,0,'dry')>0);
 assert(Math.abs(a.vx+b.vx-6)<1e-8);
 assert.equal(resolveShoulderMomentum(b,a,1,0,'wet'),0);
 const ball={vx:0,vy:14},front={vx:0,vy:0,facingX:0,facingY:-1};
 assert(firstTouchError({...front,facingY:1},ball,48,1.8,'wet')>firstTouchError(front,ball,70,3,'dry'));
 redirectHeader(ball,front,-1,55,true);
 assert(ball.vy<0&&ball.vz<0);
});

test('R5 home free kicks can be played short or struck at goal',()=>{
 for(const [command,shot] of [[FREE_KICK_PASS,false],[FREE_KICK_SHOT,true]]){
  const state=r5.createArcade('free-kick',{surface:'dry'});
  delete state.openingKickoff;
  const p=state.home[8];
  p.x=0;p.y=-28;
  Object.assign(state.ball,{owner:{team:'home',index:8},x:p.x,y:p.y,protected:0});
  state.restart={kind:'free-kick',team:'home',taker:8,indirect:false,released:false};
  state.freeze=60;state.tick=30;
  r5.stepArcade(state,command);
  assert(state.freeze<7);
  for(let tick=0;tick<7;tick++)r5.stepArcade(state,0);
  assert.equal(state.ball.shot,shot);
  assert.equal(state.restart.released,true);
  assert.equal(state.stats.homeXg>0,shot);
 }
});

test('only Auto opts into cheap lighting and a lower pixel budget',()=>{
 const scene=new Scene(),home=new Group(),away=new Group();
 const geometry=new BoxGeometry(),map=new Texture();
 const standard=new MeshStandardMaterial({map,normalMap:new Texture(),color:'#dcf589'});
 const dynamic=new Mesh(geometry,standard),still=new Mesh(geometry,standard);
 home.add(dynamic);scene.add(home,away,still);
 applyFastMatchMaterials(scene,{home:[home],away:[away]});
 assert(dynamic.material.isMeshLambertMaterial);
 assert(still.material.isMeshBasicMaterial);
 assert.equal(dynamic.material.map,map);assert(standard.normalMap);
 assert(usesFastMatchRender(11,5,'auto'));assert(!usesFastMatchRender(11,5,'4k'));assert(!usesFastMatchRender(11,2,'auto'));
 const size={width:2400,height:1080,dpr:3,version:11,fast:true};
 const output=matchResolution({...size,quality:'auto'});
 assert(output.width*output.height<422000);
 assert.deepEqual(matchResolution({...size,quality:'4k'}),matchResolution({...size,fast:false,quality:'4k'}));
});

test('distant poses share frames and the focused player updates immediately',()=>{
 const pose={};
 assert.equal(takeMatchPose(pose,10,false,true,true,.016),.016);
 assert.equal(takeMatchPose(pose,25,false,true,false,.015),-1);
 assert.equal(takeMatchPose(pose,25,true,true,false,.015),.015);
 assert.equal(takeMatchPose(pose,40,true,false,false,.015),-1);
 assert.equal(takeMatchPose(pose,55,false,true,false,.015),.015);
});

test('close camera keeps the steering axes and reduced motion removes the impact displacement',()=>{
 const state=r5.createArcade('camera'),plan=createR4CameraPlan();
 delete state.openingKickoff;state.ball.y=-25;state.lastAction={kind:'woodwork',tick:state.tick};
 const focus=state.home[state.controlled];
 assert.deepEqual(screenToPitch(.3,.7,'close'),screenToPitch(.3,.7,'broadcast'));
 const zoom=[...plan(state,'close',2,state.ball,focus,false).eye];
 const reduced=[...plan(state,'close',2,state.ball,focus,true).eye];
 assert(zoom[1]<reduced[1]);
});

import {clockWithAddedTime} from '../shared/football-r5-clock.js';
test('R5 has explicit added time in both halves and a frozen-length input tape',()=>{
 const offset={stepMs:50,halfMs:120000,halftimeMs:10000};
 assert.deepEqual(clockWithAddedTime(124000,offset),{regular:2700,added:90});
 assert.deepEqual(clockWithAddedTime(135350,offset),{regular:2700,added:0});
 assert.deepEqual(clockWithAddedTime(r5.DURATION_MS,offset),{regular:5400,added:120});
 assert.equal(r5.DURATION_MS,260700);
});

test('an aerial contact can turn into a headed shot and the keeper comes out for a playable cross',()=>{
 const setup=()=>{
  const state=r5.createArcade('aerial');
  delete state.openingKickoff;
  state.freeze=0;state.tick=30;
  for(const [team,side] of [['home',-1],['away',1]])state[team].forEach((p,index)=>{
   Object.assign(p,{x:side*20+(index%3)*2,y:side*(5+Math.floor(index/3)*5),vx:0,vy:0});
  });
  Object.assign(state.ball,{owner:null,x:0,z:1.72,vx:0,vy:-14,vz:0,protected:0,lastTouch:{team:'away',index:7},lastTeam:'away',flightKind:'loft'});
  return state;
 };
 const header=setup();
 Object.assign(header.home[8],{x:0,y:-32,facingX:0,facingY:-1});
 header.controlled=8;
 header.ball.y=-31.2;
 r5.stepArcade(header,0);
 assert.equal(header.lastContact?.kind,'header');
 assert.equal(header.ball.shot,true);
 assert(header.stats.homeXg>0);

 const claim=setup();
 Object.assign(claim.home[0],{x:0,y:40});
 Object.assign(claim.ball,{y:35,vy:16,vz:1});
 r5.stepArcade(claim,0);
 assert.equal(claim.home[0].role,'claim');
});
