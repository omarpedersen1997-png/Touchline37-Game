import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerStride,JOINT,samplePlayerStride} from '../src/player-stride-pose.js';
import {createPlayerResponse} from '../src/match-player-pose.js';
import {createMatch2DPlayers} from '../src/match-2d-players.js';
import {createR4CameraPlan} from '../src/broadcast-r4.js';
import {createMatchEventFeed} from '../src/match-event-feed.js';
import {applyStrikeMechanics,reboundFromWoodwork} from '../shared/football-r6-contact.js';
import * as engine from '../shared/football-engine11-r6.js';
import {getArcadeRules} from '../shared/arcade.js';
import {createManualSession} from '../src/manual-session.js';
import {createR4Practice} from '../src/r4-practice.js';

const runner={vx:0,vy:6.4,ax:0,ay:0,kick:0,facingX:0,facingY:1};
function point(j,i){return [j[i],j[i+1],j[i+2]];}
function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}

test('stride drives grounded boots, knee geometry and opposing arm movement at render cadence',()=>{
 const samples=[60,120].map(hz=>{
  const stride=createPlayerStride(3);
  let wasPlanted=false,worldZ=0;
  for(let f=0;f<=hz;f++){
   const z=runner.vy*f/hz,p=samplePlayerStride(stride,runner,0,z,0,1/hz);
   assert.equal(p,stride.joints);
   assert(stride.plant[0]||stride.plant[1]);
   const boot=point(p,JOINT.bootL),hip=point(p,JOINT.hipL),knee=point(p,JOINT.kneeL);
   assert(boot[1]>=.059);
   assert(Math.abs(distance(hip,knee)-.423)<.003);
   const nextWorldZ=boot[2]+z;
   if(stride.plant[0]&&wasPlanted)assert(Math.abs(nextWorldZ-worldZ)<.001);
   wasPlanted=!!stride.plant[0];worldZ=nextWorldZ;
  }
  return stride;
 });
 assert(distance(point(samples[0].joints,JOINT.kneeL),point(samples[1].joints,JOINT.kneeL))<.0001);
 assert(samples[0].joints[JOINT.neck+2]>.1,'sprint torso leans into the running direction');
});

test('a strike keeps the support foot planted and the kicking foot sweeps through',()=>{
 const move=createPlayerStride(1);
 const player={...runner,kick:0,actionDuration:10};
 const pose=samplePlayerStride(move,player,0,0,0,.016,0,false,.5);
 const backswing=pose[JOINT.bootR+2];
 assert.equal(move.plant[0],1);
 assert.equal(move.plant[1],0);
 player.kick=10;
 samplePlayerStride(move,player,0,.1,0,.016);
 assert(pose[JOINT.bootR+2]>backswing+.15);
 assert(Math.abs(pose[JOINT.bootL+1]-.06)<1e-6);
 const response=createPlayerResponse();
 assert(response.update(player,.01,{athletic:true,snap:true}).forward>.05);
});

test('Canvas 2D renders body parts above the ground in the current view and skips sent-off players',()=>{
 const points=[],ctx={
  moveTo:(...p)=>points.push(p),lineTo:(...p)=>points.push(p),arc:(...p)=>points.push(p),
  beginPath(){},ellipse(){},fill(){},stroke(){},
 };
 const draw=createMatch2DPlayers(),state={controlled:2};
 draw(ctx,state,'home',2,runner,9,14,0,7,true,.016,0,'#c1f66b',true);
 assert(points.length>=18);
 assert(points.every(values=>values.every(Number.isFinite)));
 const count=points.length;
 draw(ctx,state,'home',2,{...runner,sentOff:true},9,14,0,7,true,.016,0,'#c1f66b',false);
 assert.equal(points.length,count);
});

test('strike balance influences power, angle and curl, and woodwork returns the ball inside the pitch',()=>{
 const left={vx:0,vy:-28,vz:5,curl:0,flightKind:'shot'},right={...left},facing={...left};
 applyStrikeMechanics(left,{vx:6,vy:1,facingX:1,facingY:0},64,1.1);
 applyStrikeMechanics(right,{vx:-6,vy:1,facingX:-1,facingY:0},64,1.1);
 applyStrikeMechanics(facing,{vx:0,vy:-3,facingX:0,facingY:-1},64,6);
 assert(left.curl<0&&right.curl>0);
 assert(Math.hypot(left.vx,left.vy)<Math.hypot(facing.vx,facing.vy));
 assert(Number.isFinite(left.vz));
 const hit={vx:2,vy:-29,vz:1,curl:4};
 reboundFromWoodwork(hit,{x:4.09,y:-48,z:1},true,false);
 assert(hit.vy>0&&Math.hypot(hit.vx,hit.vy,hit.vz)<29);
 assert(hit.vx>2);
});

test('R6 keeps previous clock and protocol isolation while playing to the same result at 60 and 120 Hz',()=>{
 assert.throws(()=>getArcadeRules(11,6),/revisionen understøttes ikke/);
 const states=[];
 for(const hz of [60,120]){
  const exercise=createR4Practice(2000,{revision:6,surface:'wet'});
  const session=createManualSession(exercise.match,{storage:exercise.storage,practiceRules:exercise.rules,now:exercise.match.started});
  const duration=exercise.match.manual.duration;
  for(let n=1;n<=Math.ceil(duration*hz/1000);n++)session.advance(2000+Math.min(duration,n*1000/hz),0,{maxInputs:4});
  assert(session.complete);
  const packet=session.packet();
  assert.deepEqual(engine.replayArcade(exercise.match.manual.seed,exercise.match.manual.config,engine.decodeInputs(packet)),session.state);
  states.push([session.state,packet]);
 }
 assert.deepEqual(states[0],states[1]);
});

test('camera anticipates a confirmed shot, respects reduced motion and reports woodwork once',()=>{
 const state=engine.createArcade('frame'),plan=createR4CameraPlan(),player=state.home[state.controlled];
 delete state.openingKickoff;state.ball.owner=null;
 Object.assign(state.ball,{shot:true,y:-14,vy:-27,flight:1});
 const shot=[...plan(state,'broadcast',2,state.ball,player,false).target];
 const calm=[...plan(state,'broadcast',2,state.ball,player,true).target];
 assert(shot[2]<calm[2]-2);
 const feed=createMatchEventFeed();feed.observe(state);
 state.tick++;state.lastAction={kind:'woodwork',tick:state.tick};
 const event=feed.observe(state)[0];
 assert.equal(event.kind,'woodwork');
 assert.deepEqual(feed.observe(state),[event]);
});
