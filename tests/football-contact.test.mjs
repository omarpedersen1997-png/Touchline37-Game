import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../shared/football-contact.js';
import * as previous from '../shared/football-halves.js';

function park(s){for(const team of['home','away'])s[team].forEach((p,i)=>Object.assign(p,{x:-25+i*4,y:team==='home'?35:-35,vx:0,vy:0,cooldown:1000,decision:1000,kick:0,tackle:0}));}
function carrier(seed='contact'){
 const s=game.createArcade(seed,{personalPosition:'ANG'});park(s);
 Object.assign(s.home[10],{x:0,y:0,facingX:0,facingY:-1,cooldown:0});
 Object.assign(s.ball,{owner:{team:'home',index:10},x:0,y:-.55,z:.22,protected:0});return s;
}
function freeBall(seed='loose'){
 const s=game.createArcade(seed,{personalPosition:'ANG'});park(s);
 Object.assign(s.home[10],{x:0,y:0,facingX:0,facingY:-1,cooldown:0});
 Object.assign(s.ball,{owner:null,x:0,y:-.4,z:.22,vx:0,vy:0,vz:0,protected:0,lastTouch:{team:'away',index:1},lastTouchTick:-100,flight:20});return s;
}
const advance=(s,n,mask=0)=>{for(let i=0;i<n;i++)game.stepArcade(s,mask);};

test('engine7 preserves duration, codec, replay determinism and immutable engine6',()=>{
 assert.equal(game.ARCADE_VERSION,7);assert.equal(previous.ARCADE_VERSION,6);assert.equal(game.DURATION_MS,250000);assert.equal(game.INPUT_COUNT,5000);assert.equal(game.HALF_MS,120000);assert.equal(game.HALFTIME_MS,10000);
 const tape=Uint16Array.from({length:5000},(_,i)=>game.directionMask(Math.sin(i*.04),-1)|(i%61===0?game.SHOOT:0)|(i%37===0?game.PASS:0)|(i%100<5?game.SPRINT:0)),encoded=game.encodeInputs(tape);assert.equal(encoded.length,13336);assert.deepEqual(game.decodeInputs(encoded),tape);
 const s=game.createArcade('contact-replay');for(const mask of tape)game.stepArcade(s,mask);assert.deepEqual(game.replayArcade('contact-replay',{},game.decodeInputs(encoded)),s);assert.equal(s.period,'finished');assert.equal(s.tick,5000);assert.equal(s.home.length,11);assert.equal(s.away.length,11);assert(s.homeScore+s.awayScore<30);
 const stop=structuredClone(s);game.stepArcade(s,game.SHOOT);assert.deepEqual(s,stop);
 const half=game.createArcade('halves');advance(half,2400);assert.equal(half.period,'halftime');const frozen=structuredClone({home:half.home,away:half.away,ball:half.ball});advance(half,199,game.SHOOT);assert.deepEqual({home:half.home,away:half.away,ball:half.ball},frozen);advance(half,1);assert.equal(half.period,'second');assert.equal(half.ball.owner.team,'away');
});

test('opponents cannot take the ball from the old 1.75m automatic tackle circle',()=>{
 let legacySteals=0;
 for(let seed=0;seed<40;seed++){
  const s=carrier('remote-'+seed);Object.assign(s.away[10],{x:1.45,y:-.55,vx:0,vy:0,cooldown:0,facingX:-1,facingY:0});
  const old=structuredClone(s);old.version=6;previous.stepArcade(old,0);if(old.ball.owner?.team==='away')legacySteals++;
  game.stepArcade(s,0);assert.deepEqual(s.ball.owner,{team:'home',index:10});assert.equal(s.lastContact,undefined);assert.equal(s.away[10].tackle,0);
 }
 assert(legacySteals>0,'same fixture must reproduce the old remote steal');
});

test('manual tackle starts its visible action before contact and cannot steal from 2.65m',()=>{
 const s=game.createArcade('manual-distance',{personalPosition:'ANG'});park(s);Object.assign(s.home[10],{x:0,y:0,facingX:0,facingY:-1,cooldown:0});Object.assign(s.away[10],{x:0,y:-3,facingX:0,facingY:1});Object.assign(s.ball,{owner:{team:'away',index:10},x:0,y:-2.45,protected:0});
 game.stepArcade(s,game.SHOOT);assert.equal(s.home[10].action,'tackle');assert(s.home[10].tackle>0);assert.equal(s.lastAction.contact,false);assert.equal(s.lastContact,undefined);assert.equal(s.ball.owner.team,'away');game.stepArcade(s,0);assert.equal(s.lastContact,undefined);
 Object.assign(s.away[10],{x:-.2,y:-1.35,vx:0,vy:0,facingX:0,facingY:1});Object.assign(s.ball,{x:0,y:-.62});game.stepArcade(s,0);
 assert.equal(s.lastContact.kind,'tackle');assert.equal(s.lastContact.tick,3);assert.equal(s.lastContact.manual,true);assert.equal(s.home[10].action,'tackle');assert.equal(s.ball.owner,null,'a contact knocks the ball loose instead of teleporting ownership');assert.equal(s.ball.lastTouch.team,'home');assert.equal(s.stats.userTackles,1);assert(Math.hypot(s.lastContact.x-s.home[10].x,s.lastContact.y-s.home[10].y)<=.83);assert(s.lastContact.z<=game.CONTACT.footHeight);
});

test('standing auto tackle requires real foot reach, waits for the strike and leaves a loose ball',()=>{
 const s=carrier('near-auto');Object.assign(s.away[10],{x:0,y:-1.18,facingX:0,facingY:1,cooldown:0,decision:1000});
 game.stepArcade(s,0);assert.equal(s.away[10].action,'tackle');assert.equal(s.ball.owner.team,'home');assert.equal(s.lastContact,undefined);
 for(let i=0;i<10&&!s.lastContact;i++)game.stepArcade(s,0);
 assert.equal(s.lastContact?.kind,'tackle');assert.equal(s.lastContact.team,'away');assert.equal(s.lastContact.manual,false);assert.equal(s.ball.owner,null);assert(Math.hypot(s.lastContact.x-s.away[10].x,s.lastContact.y-s.away[10].y)<.8);
});

test('protected restarts and skill touches cannot be taken by an intersecting tackle',()=>{
 const s=carrier('protected');Object.assign(s.away[10],{x:0,y:-1.18,facingX:0,facingY:1,cooldown:15,tackle:7,pendingTackle:{manual:false,started:-2,resolved:false}});s.ball.protected=18;
 advance(s,5);assert.equal(s.ball.owner.team,'home');assert.equal(s.lastContact,undefined);
});

test('loose ground ball is received only at a foot; distant and chest-height balls remain loose',()=>{
 const close=freeBall('foot'),distant=freeBall('remote-foot'),high=freeBall('air');Object.assign(distant.ball,{x:.74,y:0});Object.assign(high.ball,{z:1.05,vz:0});
 const oldHigh=structuredClone(high);oldHigh.version=6;previous.stepArcade(oldHigh,0);assert.equal(oldHigh.ball.owner?.team,'home','old height threshold must reproduce the chest-height capture');
 game.stepArcade(close,0);assert.deepEqual(close.ball.owner,{team:'home',index:10});assert.equal(close.lastContact.kind,'touch');assert(close.lastContact.z<=.55);
 game.stepArcade(distant,0);assert.equal(distant.ball.owner,null);assert.equal(distant.lastContact,undefined);
 game.stepArcade(high,0);assert.equal(high.ball.owner,null);assert.equal(high.lastContact,undefined);
});

test('relative sweeps detect fast valid touches and reject paths that only meet at different times',()=>{
 const fast=game.sweptContact({x:-2,y:0,z:.22},{x:2,y:0,z:.22},{x:0,y:0},{x:0,y:0},.38,.55);assert(fast);assert(fast.t>.39&&fast.t<.42);assert(Math.abs(fast.x+.38)<1e-6);
 // The ball reaches x0 when the player has already moved away in the same direction.
 assert.equal(game.sweptContact({x:-2,y:0,z:.22},{x:0,y:0,z:.22},{x:0,y:0},{x:2,y:0},.38,.55),null);
 assert.equal(game.sweptContact({x:-2,y:0,z:.22},{x:2,y:0,z:.22},{x:0,y:-2},{x:0,y:0},.38,.55),null,'a player arriving after the ball crossed cannot claim it');
 assert.equal(game.sweptContact({x:-2,y:0,z:1},{x:2,y:0,z:1},{x:0,y:0},{x:0,y:0},.38,.55),null);
 const descending=game.sweptContact({x:0,y:0,z:1},{x:0,y:0,z:.2},{x:0,y:0},{x:0,y:0},.38,.55);assert(descending);assert(Math.abs(descending.t-.5625)<1e-9);
 assert.equal(game.sweptContact({x:-2,y:0,z:.22},{x:2,y:0,z:.22},{x:0,y:0},{x:0,y:0},.38,.55,.3),null,'contact after the boundary cannot prevent a goal/out');
});

test('a fast pass crossing the visible foot is intercepted while a near miss is not magnetized',()=>{
 const hit=freeBall('fast-hit'),miss=freeBall('fast-miss');for(const s of[hit,miss])Object.assign(s.ball,{x:-1,y:-.18,vx:40,vy:0,flight:12,protected:0});miss.ball.y=-1;
 game.stepArcade(hit,0);assert.deepEqual(hit.ball.owner,{team:'home',index:10});assert.equal(hit.lastContact.kind,'touch');assert(Math.abs(hit.lastContact.x)<=.38+1e-6);
 game.stepArcade(miss,0);assert.equal(miss.ball.owner,null);assert.equal(miss.lastContact,undefined);
});

test('real torso contact deflects a shot without granting chest possession; goalkeeper hands remain valid',()=>{
 const block=freeBall('torso');Object.assign(block.ball,{x:-1,y:0,z:1.2,vx:40,vy:0,vz:0,shot:true,lastShooter:{team:'away',index:1},shotId:1});game.stepArcade(block,0);assert.equal(block.ball.owner,null);assert.equal(block.lastContact.kind,'block');assert.equal(block.ball.lastTouch.team,'home');
 const keeper=freeBall('keeper');Object.assign(keeper.home[0],{x:0,y:44,facingX:0,facingY:-1,cooldown:0,decision:1000});Object.assign(keeper.ball,{x:0,y:43.65,z:1.2,vx:0,vy:0,vz:0,shot:false});game.stepArcade(keeper,0);assert.deepEqual(keeper.ball.owner,{team:'home',index:0});assert.equal(keeper.lastContact.kind,'save');assert.equal(keeper.ball.lastTouch.index,0);
});

test('keepers still anticipate and parry driven shots while a personal keeper catches a low shot once',()=>{
 const s=game.createArcade('driven-save');for(const team of['home','away'])s[team].forEach((p,i)=>Object.assign(p,{x:20+i%3,y:20+i,vx:0,vy:0,cooldown:200}));Object.assign(s.away[0],{x:0,y:-44.2,cooldown:0});Object.assign(s.ball,{owner:null,x:-5,y:-30,z:1,vx:7,vy:-31,vz:2,protected:0,shot:true,shotId:1,lastShooter:{team:'home',index:10}});
 game.stepArcade(s,0);assert(s.away[0].dive>0);advance(s,11);assert.equal(s.stats.awaySaves,1);assert.equal(s.homeScore,0);assert.equal(s.ball.owner,null);assert(s.ball.vy>0);assert.equal(s.lastContact.kind,'save');advance(s,5);assert.equal(s.stats.awaySaves,1);
 const personal=game.createArcade('personal-save',{personalPosition:'MÅL'});park(personal);Object.assign(personal.home[0],{x:0,y:44,cooldown:0});Object.assign(personal.ball,{owner:null,x:0,y:37,z:.5,vx:0,vy:18,vz:1,protected:0,shot:true,shotId:3,lastShooter:{team:'away',index:10}});advance(personal,12);assert.deepEqual(personal.ball.owner,{team:'home',index:0});assert.equal(personal.stats.userSaves,1);assert.equal(personal.controlled,0);game.stepArcade(personal,game.PASS);assert.equal(personal.stats.userSaves,1);assert.equal(personal.controlled,0);
});

test('goal-line height, posts and last-touch restarts remain correct after contact changes',()=>{
 const make=seed=>{const s=game.createArcade(seed);park(s);return s;};
 const thrown=make('throw');Object.assign(thrown.ball,{owner:null,x:29.9,y:0,vx:12,vy:0,lastTeam:'home'});game.stepArcade(thrown,0);assert.equal(thrown.restart.kind,'throw-in');assert.equal(thrown.ball.owner.team,'away');assert.equal(thrown.freeze,10);
 for(const[lastTeam,kind,team]of[['away','corner','home'],['home','goal-kick','away']]){const s=make(kind);Object.assign(s.ball,{owner:null,x:15,y:-47.9,z:3,vx:0,vy:-20,lastTeam});game.stepArcade(s,0);assert.equal(s.restart.kind,kind);assert.equal(s.ball.owner.team,team);}
 const high=make('over');Object.assign(high.ball,{owner:null,x:0,y:-47.9,z:2.8,vx:0,vy:-20,vz:-20});game.stepArcade(high,0);assert.equal(high.homeScore,0);assert.equal(high.restart.kind,'goal-kick');
 const post=make('post');Object.assign(post.ball,{owner:null,x:3.95,y:-47.7,z:1,vx:0,vy:-20,vz:0});game.stepArcade(post,0);assert.equal(post.homeScore,0);assert.equal(post.lastAction.kind,'woodwork');assert(post.ball.vy>0);
 const goal=make('goal');Object.assign(goal.ball,{owner:null,x:0,y:-47.9,z:.4,vx:0,vy:-20,lastShooter:{team:'home',index:10}});game.stepArcade(goal,0);assert.equal(goal.homeScore,1);assert.equal(goal.events.length,1);advance(goal,10,game.SHOOT);assert.equal(goal.homeScore,1);assert.equal(goal.events.length,1);
});

test('full contact-aware personal matches stay finite, bounded and locked to the selected role',()=>{
 for(const[formation,personalPosition]of[['4-3-3','ANG'],['4-4-2','MID'],['3-5-2','FOR'],['4-5-1','MÅL']]){
  const s=game.createArcade(formation,{formation,personalPosition});
  for(let i=0;i<5000;i++){
   game.stepArcade(s,game.directionMask(Math.sin(i*.04),-Math.cos(i*.04))|(i%71===0?game.SHOOT:0)|(i%37===0?game.PASS:0));assert.equal(s.controlled,s.personalIndex);
   for(const p of[...s.home,...s.away]){for(const key of['x','y','vx','vy','energy'])assert(Number.isFinite(p[key]));assert(Math.abs(p.x)<=29.5&&Math.abs(p.y)<=47.4);}
   for(const key of['x','y','z','vx','vy','vz'])assert(Number.isFinite(s.ball[key]));assert(Math.abs(s.ball.x)<=30&&Math.abs(s.ball.y)<=48&&s.ball.z>=.22);
  }
  assert.equal(s.period,'finished');assert.equal(s.tick,5000);
 }
});
