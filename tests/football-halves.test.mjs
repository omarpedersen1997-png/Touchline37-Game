import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../shared/football-halves.js';
import * as legacy from '../shared/football-pro.js';
import {getArcadeRules} from '../shared/arcade.js';
import {createManualSession} from '../src/manual-session.js';
import {matchCamera} from '../src/match-camera.js';
import {visibleBallDiameter} from '../src/match-ball-visibility.js';
import {PerspectiveCamera,Vector3} from 'three';
const play=(s,n,mask=0)=>{for(let i=0;i<n;i++)game.stepArcade(s,mask);};
test('v6 runs two 120-second halves around a 10-second interval and ends once',()=>{
 const s=game.createArcade('two-halves');assert.equal(getArcadeRules(6).DURATION_MS,250000);assert.equal(legacy.INPUT_COUNT,1200);
 play(s,2399);assert.equal(s.period,'first');assert.equal(s.half,1);
 play(s,1);assert.equal(s.period,'halftime');assert.equal(s.intermissionRemaining,10000);assert.equal(game.playingTime(s.tick*50),120000);
 const frozen=structuredClone({home:s.home,away:s.away,ball:s.ball,stats:s.stats,events:s.events});
 play(s,199,game.SHOOT|game.SKILL|game.SPRINT);assert.equal(s.intermissionRemaining,50);assert.deepEqual({home:s.home,away:s.away,ball:s.ball,stats:s.stats,events:s.events},frozen);
 play(s,1);assert.equal(s.period,'second');assert.equal(s.half,2);assert.equal(s.intermissionRemaining,0);assert.equal(game.playingTime(s.tick*50),120000);assert.equal(s.ball.owner.team,'away');assert.equal(s.lastMask,0);
 play(s,2399);assert.equal(s.period,'second');play(s,1);assert.equal(s.period,'finished');assert.equal(s.tick,5000);assert.equal(game.playingTime(s.tick*50),240000);
 const finished=structuredClone(s);play(s,10,game.SHOOT);assert.deepEqual(s,finished);
});
test('long recording has strict padded codec and deterministic complete replay',()=>{
 const inputs=Uint16Array.from({length:5000},(_,i)=>game.directionMask(Math.sin(i*.03),-1)|(i%31===0?game.SHOOT:0)|(i%49===0?game.PASS:0));
 const encoded=game.encodeInputs(inputs);assert.equal(encoded.length,13336);assert(encoded.endsWith('=='));assert.deepEqual(game.decodeInputs(encoded),inputs);
 for(const bad of[encoded.slice(1),encoded+'A',encoded.replace(/==$/,'AA'),'!'.repeat(13336)])assert.throws(()=>game.decodeInputs(bad));
 const invalid=new Uint8Array(10000);invalid[1]=128;assert.throws(()=>game.decodeInputs(btoa(String.fromCharCode(...invalid))));
 const s=game.createArcade('long-replay');for(const mask of inputs)game.stepArcade(s,mask);assert.deepEqual(game.replayArcade('long-replay',{},game.decodeInputs(encoded)),s);
});
test('resuming during the interval preserves its remaining time and finishes at 250 seconds',()=>{
 const map=new Map(),storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const match={id:'halves-session',started:1000,ends:251000,manual:{version:6,seed:'resume',config:{matchVersion:6},expiresAt:431000}};
 const a=createManualSession(match,{storage,now:1000});a.advance(125000);a.save();assert.equal(a.state.intermissionRemaining,6000);
 const b=createManualSession(match,{storage,now:125000});assert.deepEqual(b.state,a.state);b.advance(131000);assert.equal(b.state.period,'second');assert(!b.complete);b.advance(250999);assert(!b.complete);b.advance(251000);assert(b.complete);assert.equal(game.decodeInputs(b.packet()).length,5000);assert.equal(b.state.period,'finished');
});
test('closer fixed lens keeps the ball inside the frame even when the controlled player is far away',()=>{
 const s=game.createArcade('frame'),old=legacy.createArcade('frame'),distance=p=>Math.hypot(...p.eye.map((v,i)=>v-p.target[i]));
 assert(distance(matchCamera(s,'pro',1.9))<distance(matchCamera(old,'pro',1.9))*.85);
 for(const view of['pro','broadcast'])for(const aspect of[1.5,1.9,2.4]){
  let lens;
  for(const [x,y,bx,by]of[[29,46,-29,-46],[-29,-46,29,46],[0,0,0,0],[29,-46,-29,46]]){
   Object.assign(s.home[s.controlled],{x,y});Object.assign(s.ball,{x:bx,y:by});const plan=matchCamera(s,view,aspect),next=[...plan.eye.map((v,i)=>Math.round((v-plan.target[i])*1e6)),plan.fov];if(lens)assert.deepEqual(next,lens);lens=next;
   const camera=new PerspectiveCamera(plan.fov,aspect,.5,800);camera.position.set(...plan.eye);camera.lookAt(new Vector3(...plan.target));camera.updateMatrixWorld();const screen=new Vector3(bx,.22,by).project(camera);assert(Math.abs(screen.x)<.8&&Math.abs(screen.y)<.8,JSON.stringify({view,aspect,screen}));
  }
 }
});
test('ball is at least six CSS pixels in the closer gameplay lens, independent of output resolution',()=>{
 for(const height of[320,400,480,720])for(const distance of[25,30,34]){const diameter=visibleBallDiameter(distance,42,height),pixels=diameter/(2*distance*Math.tan(42*Math.PI/360))*height;assert(pixels>=6-1e-9);assert(diameter>=.2508&&diameter<=.5);}
 assert.equal(visibleBallDiameter(300,60,320),.5);
});
