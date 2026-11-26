import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,kickOff,stepMatch,swapRoles,substitute,setTactics,PHASE,HALF_TICKS,timeLabel} from '../src/engine.js';
import {FIELD,STEP,integrateBall,kickBall} from '../src/physics.js';
import {createMatchLoop} from '../src/loop.js';
import {newClub,trainClub,loadClub,saveClub,nextMatch,settleMatch} from '../src/club.js';

function checkKickoff(s){
  assert.deepEqual([s.ball.x,s.ball.y,s.ball.vx,s.ball.vy,s.ball.vz],[0,0,0,0,0]);
  for(let i=0;i<2;i++)for(const p of s.teams[i].players){
    assert.ok(p.x*s.teams[i].direction<0,'all players on their own half');
    if(i!==s.kickTeam)assert.ok(Math.hypot(p.x,p.y)>FIELD.circle,'opponents outside the circle');
  }
}
function finish(s){
  const scratch={};
  while(s.phase!==PHASE.FULL_TIME){
    kickOff(s);
    stepMatch(s,scratch);
  }
}
test('opening never progresses without user action, kickoff is a short backward pass',()=>{
  const s=createMatch();
  checkKickoff(s);
  const p=structuredClone(s), frame=createMatchLoop(s);
  for(let i=0;i<250;i++)frame.advance(i*17,4);
  assert.deepEqual(s,p);
  assert.equal(s.phase,PHASE.PRE_KICKOFF);
  assert.equal(timeLabel(s),'00:00');
  assert.ok(kickOff(s));
  assert.equal(kickOff(s),false);
  assert.ok(s.ball.vx*s.teams[0].direction<0);
  assert.equal(s.teams[0].stats.passes,1);
  assert.equal(s.events[0].kind,'kickoff');
  stepMatch(s);
  assert.equal(timeLabel(s),'00:01');
});
test('halftime stops at 45:00, ends change, and requires another kick off',()=>{
  const s=createMatch();kickOff(s);s.tick=HALF_TICKS-1;stepMatch(s);
  assert.equal(s.phase,PHASE.KICKOFF_READY);
  assert.equal(s.kickTeam,1);assert.equal(s.half,2);assert.equal(s.teams[0].direction,-1);
  assert.equal(timeLabel(s),'45:00');checkKickoff(s);
  assert.equal(stepMatch(s),false);
  assert.ok(kickOff(s));stepMatch(s);assert.equal(timeLabel(s),'45:01');
});
test('goal registers once and the conceding side waits at centre for the user',()=>{
  const s=createMatch();kickOff(s);
  Object.assign(s.ball,{x:52.3,y:0,z:.4,vx:25,vy:0,vz:0,lastTeam:0,lastSlot:9,kind:'shot'});
  stepMatch(s);
  assert.equal(s.teams[0].stats.goals,1);assert.equal(s.kickTeam,1);
  assert.equal(s.phase,PHASE.KICKOFF_READY);checkKickoff(s);
  const snapshot=structuredClone(s);assert.equal(stepMatch(s),false);assert.deepEqual(s,snapshot);
  assert.ok(kickOff(s));assert.ok(s.ball.vx>0);
});
test('sideline, goal kick, corner and woodwork produce different outcomes',()=>{
  for(const [x,y,z,lastTeam,expected] of [
    [52.35,12,.2,0,'goal-kick'],[52.35,12,.2,1,'corner'],[0,33.9,.2,0,'throw'],[52.35,3.67,.5,0,'woodwork']
  ]){
    const s=createMatch();kickOff(s);
    Object.assign(s.ball,{x,y,z,vx:x?29:0,vy:x?0:26,lastTeam,kind:'shot'});
    stepMatch(s);
    if(expected==='woodwork'){assert.ok(s.ball.vx<0);assert.equal(s.teams[0].stats.goals,0);}
    else {
      assert.equal(s.restart.kind,expected);
      assert.equal(s.phase,PHASE.DEAD_BALL);
      for(let i=0;i<28;i++)stepMatch(s);
      assert.equal(s.phase,PHASE.PLAYING);
    }
  }
});
test('same seed and tactics produce the same full match including all statistics',()=>{
  const matches=[createMatch({seed:89}),createMatch({seed:89})];
  for(const match of matches){setTactics(match,0,{formation:'3-5-2',mentality:'attack',press:'high'});finish(match);}
  assert.deepEqual(...matches);
  const a=matches[0];
  assert.equal(timeLabel(a),'90:00');
  assert.ok(a.teams.every(t=>t.stats.passes>0&&t.stats.possession>0));
  assert.ok(a.teams[0].stats.shots+a.teams[1].stats.shots>0);
  assert.ok(a.teams.flatMap(t=>t.players).some(p=>p.energy<95));
  assert.equal(stepMatch(a),false);
});
test('60 and 120 Hz callbacks or 2× playback preserve the fixed step',()=>{
  const play=(hz,speed)=>{
    const s=createMatch();kickOff(s);
    const frame=createMatchLoop(s);
    for(let i=0;i<=hz*8/speed;i++)frame.advance(i*1000/hz,speed);
    assert.ok(s.tick>=239&&s.tick<=240);
    return s;
  };
  assert.deepEqual(play(60,1),play(120,1));
  assert.deepEqual(play(60,1),play(60,2));
});
test('position changes move tactical destinations and substitutions preserve player statistics',()=>{
  const s=createMatch(), h=s.teams[0], before=h.players[4].y;
  assert.equal(swapRoles(s,0,0,4),false);
  assert.ok(swapRoles(s,0,4,1));
  assert.notEqual(h.players[4].y,before);
  const bench=h.bench[0].id;
  assert.equal(substitute(s,0,0,bench),false);
  kickOff(s);stepMatch(s);
  const outgoing=h.players[4];
  assert.ok(substitute(s,0,4,bench));
  assert.equal(h.players[4].roleSlot,1);
  assert.equal(h.subs,1);
  assert.equal(h.used[0].id,outgoing.id);
  assert.equal(h.bench.some(p=>p.id===outgoing.id),false);
});
test('lofts curve, crest, descend and bounce on the same field as grounded passes',()=>{
  const flat={x:0,y:0,z:.11}, loft={x:0,y:0,z:.11};
  kickBall(flat,20,0,18);
  kickBall(loft,20,0,18,5.8,.28);
  let max=0, bounced=false;
  for(let i=0;i<90;i++){
    const falling=loft.vz<0;
    integrateBall(loft,STEP);integrateBall(flat,STEP);
    max=Math.max(max,loft.z);
    if(falling&&loft.z===.11&&loft.vz>0)bounced=true;
  }
  assert.ok(max>1.6&&bounced&&loft.y>0);
  assert.equal(flat.z,.11);assert.equal(flat.y,0);
});
test('save and resume preserve determinism and match winnings apply once',()=>{
  let value;
  const storage={setItem:(key,data)=>{value=data;},getItem:()=>value};
  const club=newClub();assert.equal(trainClub(club),true);assert.equal(trainClub(club),false);
  const s=nextMatch(club);kickOff(s);for(let i=0;i<600;i++)stepMatch(s);
  assert.equal(saveClub(club,storage),true);
  const loaded=loadClub(storage);assert.deepEqual(loaded,club);
  finish(s);finish(loaded.active);assert.deepEqual(s,loaded.active);
  const old=club.budget, receipt=settleMatch(club,s);
  assert.equal(club.budget,old+receipt.revenue);assert.equal(settleMatch(club,s),null);
  assert.equal(club.played,1);
  value='corrupt';assert.deepEqual(loadClub(storage),newClub());
});
