import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../shared/football-receiving.js';
import * as previous from '../shared/football-tactics.js';

function passFixture(engine=game,runner={x:0,y:-18,vx:0,vy:0},config={}) {
 const s=engine.createArcade('receiving-regression',{homeRating:60,awayRating:50,...config});
 for(const team of['home','away'])s[team].forEach((p,i)=>Object.assign(p,{x:-28+i*5,y:team==='home'?40:44,vx:0,vy:0,cooldown:1000,decision:1000}));
 Object.assign(s.home[10],{x:0,y:0,vx:0,vy:0,cooldown:0,facingX:0,facingY:-1});
 Object.assign(s.home[8],runner);
 Object.assign(s.ball,{owner:{team:'home',index:10},x:0,y:-.55,z:.22,protected:0});
 return s;
}
function launchAndReceive(s,engine=game,mask=engine.THROUGH) {
 engine.stepArcade(s,mask);const target=s.lastAction.target,point=structuredClone(s.ball.receivePoint),initial=s.home[target];
 assert.equal(s.lastAction.kind,mask&engine.THROUGH?'through':'pass');assert.equal(target,8);
 assert.equal(s.ball.owner,null,'a pass starts a free, independently moving ball');
 const start={x:initial.x,y:initial.y};let contact=null,frame=null;
 for(let i=0;i<80&&!s.ball.owner;i++){
  frame=s.home.map(p=>({x:p.x,y:p.y,facingX:p.facingX,facingY:p.facingY}));engine.stepArcade(s,0);
  if(s.lastContact?.tick===s.tick)contact={...s.lastContact};
 }
 return{target,point,start,contact,frame};
}
function physicalFoot(s,result) {
 const hit=result.contact;assert(hit,'the receiving touch must be recorded');assert.equal(hit.kind,'touch');assert.equal(hit.team,'home');assert.equal(hit.index,8);
 const before=result.frame[8],p=s.home[8],t=hit.time;
 const start={x:before.x+before.facingX*game.CONTACT.footOffset,y:before.y+before.facingY*game.CONTACT.footOffset};
 const end={x:p.x+p.facingX*game.CONTACT.footOffset,y:p.y+p.facingY*game.CONTACT.footOffset};
 assert(Math.hypot(hit.x-start.x-(end.x-start.x)*t,hit.y-start.y-(end.y-start.y)*t)<=game.CONTACT.footRadius+.002,'ownership requires the real swept foot, not a larger receive radius');
 assert(hit.z<=game.CONTACT.footHeight);assert.equal(s.stats.homeCompletedPasses,1);assert.equal(s.stats.completedPasses,1);
}

test('engine9 keeps old matches immutable, the 2-minute halves, tactical commands and packet size',()=>{
 assert.equal(game.ARCADE_VERSION,9);assert.equal(previous.ARCADE_VERSION,8);assert.equal(game.HALF_MS,120000);assert.equal(game.HALFTIME_MS,10000);assert.equal(game.DURATION_MS,250000);assert.equal(game.INPUT_COUNT,5000);assert.deepEqual(game.CONTACT,previous.CONTACT);assert.deepEqual(game.TACTICAL_COMMANDS,previous.TACTICAL_COMMANDS);
 const tape=new Uint16Array(game.INPUT_COUNT);tape[0]=game.TACTICAL_COMMANDS.attacking;tape[100]=game.THROUGH;tape[2401]=game.TACTICAL_COMMANDS['4-4-2'];const encoded=game.encodeInputs(tape);assert.equal(encoded.length,13336);assert.deepEqual(game.decodeInputs(encoded),tape);
 for(const n of[32768,32776,65535])assert(!game.validateMask(n));
});

test('stationary, running and diagonal receivers reach a through ball in stride at physical foot contact',()=>{
 for(const runner of[{x:0,y:-18,vx:0,vy:0},{x:0,y:-18,vx:0,vy:-6},{x:12,y:-16,vx:3,vy:-5},{x:-18,y:-10,vx:-4,vy:-4},{x:8,y:-8,vx:6,vy:0}]){
  const s=passFixture(game,runner),result=launchAndReceive(s);assert.deepEqual(s.ball.owner,{team:'home',index:8},JSON.stringify(runner));
  assert(s.home[8].y<result.start.y-1,'a through ball invites a forward run rather than pulling the receiver back toward the passer');
  assert(Math.hypot(s.home[8].vx,s.home[8].vy)>2,'the first touch preserves running momentum');physicalFoot(s,result);
  assert.equal(s.controlled,8,'club control transfers only after actual reception');
 }
});

test('short and wide through balls reproduce engine8 overshoots and now reach their intended teammate',()=>{
 for(const runner of[{x:4,y:-5,vx:0,vy:-6},{x:15,y:-7,vx:0,vy:-7}]){
  const old=passFixture(previous,runner);launchAndReceive(old,previous);assert.notDeepEqual(old.ball.owner,{team:'home',index:8},'the old engine must reproduce the reported missed receiving run');
  const s=passFixture(game,runner),result=launchAndReceive(s);assert.deepEqual(s.ball.owner,{team:'home',index:8});physicalFoot(s,result);
  assert(Math.abs(result.point.y-runner.y)<Math.abs(old.home[8].y-runner.y),'the invitation must stay within an attainable lead distance');
 }
});

test('unopposed short, wide and diagonal receiving runs remain reachable across 180 position/velocity combinations',()=>{
 let received=0;
 for(const x of[-20,-10,0,10,20])for(const y of[-5,-10,-15,-20])for(const vx of[-3,0,3])for(const vy of[0,-4,-7]){
  const runner={x,y,vx,vy},s=passFixture(game,runner),result=launchAndReceive(s);
  assert.deepEqual(s.ball.owner,{team:'home',index:8},JSON.stringify(runner));physicalFoot(s,result);received++;
 }
 assert.equal(received,180);
});

test('ordinary ground passes still meet stationary and moving teammates without forced airborne captures',()=>{
 for(const runner of[{x:0,y:-18,vx:0,vy:0},{x:12,y:-16,vx:3,vy:-5},{x:4,y:-5,vx:0,vy:-6}]){
  const s=passFixture(game,runner),result=launchAndReceive(s,game,game.PASS);assert.deepEqual(s.ball.owner,{team:'home',index:8});physicalFoot(s,result);
 }
});

test('a real opponent foot in the lane can intercept the through ball before its intended receiver',()=>{
 const s=passFixture(game,{x:15,y:-7,vx:0,vy:-7});Object.assign(s.away[10],{x:7.5,y:-7,vx:0,vy:0,facingX:0,facingY:1});
 game.stepArcade(s,game.THROUGH);let defender=null;
 for(let i=0;i<40&&!s.ball.owner;i++){game.stepArcade(s,0);if(s.lastContact?.team==='away')defender=s.lastContact;}
 assert.equal(s.ball.owner?.team,'away');assert.equal(s.stats.homeCompletedPasses,0);assert.equal(defender?.kind,'touch');assert(defender.z<=game.CONTACT.footHeight);
 assert.equal(s.controlled,10,'the intended target does not receive control when the ball is intercepted');
});

test('missed and high balls remain free outside the unchanged foot contact volume',()=>{
 for(const [x,z]of[[.74,.22],[0,1.05]]){
  const s=passFixture(game,{}, {personalPosition:'ANG'});Object.assign(s.home[10],{x:0,y:0,facingX:0,facingY:-1,cooldown:0});
  Object.assign(s.ball,{owner:null,x,y:-.18,z,vx:0,vy:0,vz:0,passTarget:null,receivePoint:null,lastTouch:{team:'away',index:1},lastTouchTick:-100});
  game.stepArcade(s,0);assert.equal(s.ball.owner,null);assert.equal(s.lastContact,undefined);
 }
});

test('personal career receiving never overrides the joystick or transfers control to another player',()=>{
 const s=passFixture(game,{}, {personalPosition:'MID'});Object.assign(s.home[6],{x:7,y:-12,vx:0,vy:0,facingX:0,facingY:-1,cooldown:0});
 const right=game.directionMask(1,0);game.stepArcade(s,right|game.THROUGH);assert.equal(s.ball.passTarget.index,6,'call-for-pass still targets the career player');
 const y=s.home[6].y;
 for(let i=0;i<8;i++){game.stepArcade(s,right);assert.equal(s.controlled,6);assert.equal(s.home[6].role,'controlled');}
 assert(s.home[6].x>9,'the user continues moving right rather than being autopiloted toward the planned reception');assert.equal(s.home[6].y,y);
});

test('recorded receiving and tactical inputs replay deterministically through both halves',()=>{
 const config={personalPosition:'MID',formation:'4-3-3'},tape=Uint16Array.from({length:game.INPUT_COUNT},(_,i)=>game.directionMask(Math.sin(i*.04),-Math.cos(i*.02))|(i%53===0?game.THROUGH:i%31===0?game.PASS:0)|(i%73===0?game.SHOOT:0));
 tape[100]=game.TACTICAL_COMMANDS.attacking;tape[2401]=game.TACTICAL_COMMANDS['3-5-2'];const s=game.createArcade('receiving-tape',config);
 for(const mask of tape)game.stepArcade(s,mask);assert.deepEqual(game.replayArcade('receiving-tape',config,game.decodeInputs(game.encodeInputs(tape))),s);assert.equal(s.period,'finished');assert.equal(s.controlled,s.personalIndex);assert.equal(s.formation,'3-5-2');
 for(const team of['home','away'])for(const p of s[team]){for(const k of['x','y','vx','vy'])assert(Number.isFinite(p[k]));assert(Math.abs(p.x)<=29.5&&Math.abs(p.y)<=47.4);}
});
