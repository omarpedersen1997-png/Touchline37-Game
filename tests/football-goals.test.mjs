import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../shared/football-goals.js';
import * as previous from '../shared/football-receiving.js';

const advance=(s,n,mask=0)=>{for(let i=0;i<n;i++)game.stepArcade(s,mask);};
function goalFixture({side='home',tick=100,config={},ball={}}={}){
 const s=game.createArcade('goal-flow',{personalPosition:'ANG',...config}),sign=side==='home'?-1:1;
 s.tick=tick;
 for(const team of ['home','away'])s[team].forEach((p,i)=>Object.assign(p,{x:-27+i*5,y:team==='home'?20:-20,vx:0,vy:0,cooldown:1000,decision:1000,energy:45+i}));
 Object.assign(s[side][10],{x:2,y:sign*43,vx:3,vy:sign*5});
 Object.assign(s[side][8],{x:5,y:sign*40});Object.assign(s[side][9],{x:-4,y:sign*40});
 Object.assign(s.ball,{owner:null,x:.5,y:sign*47.9,z:.45,vx:3,vy:sign*22,vz:1.5,lastTouch:{team:side,index:10},lastShooter:{team:side,index:10},assist:{team:side,index:8},lastTouchTick:-100,protected:0,...ball});
 return s;
}

test('engine10 preserves the two 120-second halves and old uint16 control protocol',()=>{
 assert.equal(game.ARCADE_VERSION,10);assert.equal(previous.ARCADE_VERSION,9);assert.equal(game.DURATION_MS,250000);assert.equal(game.INPUT_COUNT,5000);assert.equal(game.HALF_MS,120000);assert.equal(game.HALFTIME_MS,10000);assert.deepEqual(game.CONTACT,previous.CONTACT);assert.deepEqual(game.TACTICAL_COMMANDS,previous.TACTICAL_COMMANDS);
 const tape=new Uint16Array(5000);tape[0]=game.THROUGH;tape[3]=game.TACTICAL_COMMANDS.attacking;assert.deepEqual(game.decodeInputs(game.encodeInputs(tape)),tape);
});

test('a scored ball keeps the real crossing, scorer, assist and player positions instead of teleporting to kickoff',()=>{
 const s=goalFixture(),before=structuredClone(s);game.stepArcade(s,0);
 assert.equal(s.homeScore,1);assert.equal(s.awayScore,0);assert.equal(s.goalSequence.stage,'net');assert.equal(s.goalSequence.startedTick,s.tick);assert.equal(s.goalSequence.scorer,10);assert.equal(s.goalSequence.assister,8);assert.equal(s.goalSequence.kickoffTeam,'away');assert.equal(s.goalSequence.netSide,-1);assert.equal(s.freeze,0);
 assert.equal(s.ball.owner,null);assert.equal(s.ball.y,-48);assert(Math.abs(s.ball.vy-s.lastGoal.ball.vy)<.0001);assert.equal(s.lastGoal.ball.y,-48);assert.equal(s.lastGoal.scorer,10);assert.equal(s.lastGoal.assister,8);assert.equal(s.lastGoal.ownGoal,false);assert.equal(s.stats.userGoals,1);
 for(const team of ['home','away'])s[team].forEach((p,i)=>assert(Math.hypot(p.x-before[team][i].x,p.y-before[team][i].y)<.7));
 const snapshot=structuredClone(s.lastGoal);advance(s,30);assert.deepEqual(s.lastGoal,snapshot,'the actual line-crossing snapshot stays immutable');
});

test('the ball hits the correct net, loses energy and never becomes a live second goal during celebrations',()=>{
 for(const side of ['home','away']){
  const s=goalFixture({side});game.stepArcade(s,0);const sign=s.goalSequence.netSide,incoming=Math.hypot(s.ball.vx,s.ball.vy,s.ball.vz);let impact=null,deepest=48;
  for(let i=0;i<55;i++){
   const before={x:s.ball.x,y:s.ball.y,z:s.ball.z};game.stepArcade(s,game.SHOOT|game.PASS|game.SPRINT);
   assert.equal(s.homeScore+s.awayScore,1);assert.equal(s.events.filter(e=>e.kind==='goal').length,1);assert.equal(s.ball.owner,null);
   assert(Math.hypot(s.ball.x-before.x,s.ball.y-before.y,s.ball.z-before.z)<1.25,'the scored ball travels continuously');
   assert(s.ball.y*sign<=49.7801);assert(s.ball.z>=.22&&s.ball.z<=2.18);if(s.ball.y*sign>=48)assert(Math.abs(s.ball.x)<=3.7801);
   deepest=Math.max(deepest,s.ball.y*sign);if(s.goalSequence.impact)impact={...s.goalSequence.impact};
  }
  assert(deepest>49.5,'the actual ball reaches the back of the net');assert.equal(impact.surface,'back');assert.equal(Math.sign(impact.y),sign);assert(impact.strength>0&&impact.strength<=1);assert(Math.hypot(s.ball.vx,s.ball.vy,s.ball.vz)<incoming*.03);assert.equal(s.goalSequence.team,side);
 }
});

test('only the scorer and nearby teammates gather continuously before a deliberate protected kickoff',()=>{
 const s=goalFixture();game.stepArcade(s,0);const start=s.tick,energy={home:s.home.map(p=>p.energy),away:s.away.map(p=>p.energy)},ids=[...s.home];
 assert(s.goalSequence.celebrants.includes(10));assert(s.goalSequence.celebrants.includes(8));assert(s.goalSequence.celebrants.includes(9));assert.equal(s.goalSequence.celebrants.length,3);
 for(let i=1;i<60;i++){
  const before=s.home.map(p=>({x:p.x,y:p.y}));game.stepArcade(s,i===25?game.TACTICAL_COMMANDS['4-4-2']:game.SHOOT);
  assert.equal(s.goalSequence.stage,i<18?'net':'celebration');assert.equal(s.goalSequence.elapsedTicks,i);assert.equal(s.goalSequence.remainingTicks,84-i);assert.equal(s.freeze,0);
  s.home.forEach((p,j)=>{assert.equal(p,ids[j]);assert(Math.hypot(p.x-before[j].x,p.y-before[j].y)<.5,'celebrants run rather than teleport');});
 }
 game.stepArcade(s,0);assert.equal(s.tick-start,60);assert.equal(s.goalSequence.stage,'kickoff');assert.equal(s.goalSequence.stageTicks,0);assert.equal(s.freeze,24);assert.deepEqual(s.ball.owner,{team:'away',index:10});assert(Math.abs(s.ball.y)<2);assert.equal(s.formation,'4-4-2');
 for(const team of ['home','away'])assert.deepEqual(s[team].map(p=>p.energy),energy[team],'a goal does not silently replenish fitness');
 const positions=structuredClone({home:s.home,away:s.away});advance(s,23,game.SHOOT);assert.equal(s.goalSequence.stage,'kickoff');assert.equal(s.freeze,1);assert.deepEqual({home:s.home,away:s.away},positions);
 game.stepArcade(s,0);assert.equal(s.goalSequence,null);assert.equal(s.freeze,0);assert.equal(s.homeScore,1);assert.equal(s.controlled,s.personalIndex);game.stepArcade(s,0);assert.equal(s.tick-start,85);
});

test('roof and side net contacts stay within the real goal volume and report their surface',()=>{
 for(const [ball,surface]of[[{x:3.3,vx:12,vy:-16,vz:0},'side'],[{z:2.1,vz:5,vx:0,vy:-16},'roof']]){
  const s=goalFixture({ball});game.stepArcade(s,0);assert.equal(s.homeScore,1);let hit=false;
  for(let i=0;i<16;i++){game.stepArcade(s,0);assert(s.ball.z<=2.18&&Math.abs(s.ball.x)<=3.78);if(s.goalSequence.impact?.surface===surface)hit=true;}
  assert(hit,surface+' net collision must be observable');
 }
});

test('woodwork is not a goal and an own goal never invents an attacking scorer or assist',()=>{
 const post=goalFixture({ball:{x:4,vx:0,vz:0}});game.stepArcade(post,0);assert.equal(post.homeScore,0);assert.equal(post.goalSequence,null);assert.equal(post.lastAction.kind,'woodwork');assert(post.ball.vy>0);
 const own=goalFixture({ball:{lastShooter:null,lastTouch:{team:'away',index:3},assist:null}});game.stepArcade(own,0);assert.equal(own.homeScore,1);assert.equal(own.goalSequence.scorer,null);assert.equal(own.goalSequence.assister,null);assert.deepEqual(own.goalSequence.celebrants,[]);assert.equal(own.lastGoal.ownGoal,true);assert.equal(own.stats.userGoals,0);
});

test('a controlled opponent collection ends a stale shot before a subsequent own-goal crossing',()=>{
 const s=goalFixture({ball:{x:0,y:-.5,z:.22,vx:0,vy:6,vz:0,shot:true}});
 Object.assign(s.away[3],{x:0,y:0,vx:0,vy:0,facingX:0,facingY:-1});
 game.stepArcade(s,0);assert.deepEqual(s.ball.owner,{team:'away',index:3});assert.equal(s.ball.lastShooter,null);assert.equal(s.ball.assist,null);assert.equal(s.ball.shot,false);
 Object.assign(s.ball,{owner:null,x:0,y:-47.9,z:.4,vx:0,vy:-20,vz:0,lastTouchTick:-100});Object.assign(s.away[3],{x:20,y:-20});
 game.stepArcade(s,0);assert.equal(s.homeScore,1);assert.equal(s.lastGoal.scorer,null);assert.equal(s.lastGoal.assister,null);assert.equal(s.lastGoal.ownGoal,true);assert.equal(s.stats.userGoals,0);
});

test('a goal on the halftime or final whistle cannot carry a stale celebration or kickoff into the next period',()=>{
 const half=goalFixture({tick:2399});game.stepArcade(half,0);assert.equal(half.homeScore,1);assert.equal(half.period,'halftime');assert.equal(half.goalSequence,null);assert.equal(half.freeze,0);assert.equal(half.ball.y,-48,'the whistle does not instantly move a scored ball to midfield');assert.equal(half.lastGoal.tick,2400);advance(half,199);assert.equal(half.ball.y,-48);assert.equal(half.period,'halftime');game.stepArcade(half,0);assert.equal(half.period,'second');assert.equal(half.half,2);assert.deepEqual(half.ball.owner,{team:'away',index:10});assert.equal(half.freeze,0);
 const end=goalFixture({tick:4999});game.stepArcade(end,0);assert.equal(end.homeScore,1);assert.equal(end.period,'finished');assert.equal(end.goalSequence,null);assert.equal(end.freeze,0);assert.equal(end.ball.y,-48);const terminal=structuredClone(end);game.stepArcade(end,game.SHOOT);assert.deepEqual(end,terminal);
});

test('goal flows with tactics and personal controls replay exactly on the server through both halves',()=>{
 const tape=Uint16Array.from({length:game.INPUT_COUNT},(_,i)=>game.directionMask(Math.sin(i*.03),-1)|(i%61===0?game.SHOOT:0)|(i%37===0?game.THROUGH:0));
 tape[20]=game.TACTICAL_COMMANDS.attacking;tape[2405]=game.TACTICAL_COMMANDS['4-4-2'];
 const config={personalPosition:'MID',homeRating:65,awayRating:55},s=game.createArcade('goal-sequence-replay',config);for(const mask of tape)game.stepArcade(s,mask);
 assert.deepEqual(game.replayArcade('goal-sequence-replay',config,game.decodeInputs(game.encodeInputs(tape))),s);assert.equal(s.tick,5000);assert.equal(s.period,'finished');assert.equal(s.goalSequence,null);assert.equal(s.controlled,s.personalIndex);
 for(const team of ['home','away'])for(const p of s[team])for(const key of ['x','y','vx','vy','energy'])assert(Number.isFinite(p[key]));
});
