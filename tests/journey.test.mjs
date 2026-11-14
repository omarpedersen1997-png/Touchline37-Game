import{test}from'node:test';import assert from'node:assert/strict';
import{createGame,apply,publicState}from'../worker/game.js';
import{missionsFor,claimMission}from'../worker/objectives.js';
test('advanced milestones require real progress, expose bounded progress and pay once',()=>{
 const s=createGame(0);const ids=['academy-first','staff-first','fans-500','fans-2000','career-ten','career-fifty','cup-first'];
 for(const id of ids){assert.equal(missionsFor(s,0).find(m=>m.id===id).ready,false);assert.throws(()=>claimMission(s,id,0))}
 s.career={startedAt:0,matches:50,graduates:1,cupsWon:1};s.staff.coach=1;s.supporters=2000;
 for(const id of ids){const m=missionsFor(s,0).find(m=>m.id===id),before=s.money;assert.equal(m.ready,true);assert.equal(m.progress,m.total);claimMission(s,id,0);assert.equal(s.money,before+m.reward);assert.throws(()=>claimMission(s,id,0));assert.equal(s.money,before+m.reward)}
 assert.equal(new Set(missionsFor(s,0).map(m=>m.id)).size,15);
});
test('old clubs gain new goals without losing their previous claims; action retries cannot duplicate new rewards',()=>{
 const s=createGame(0);delete s.staff;delete s.supporters;s.claimedMissions=['name','upgrade'];
 const view=publicState(s,0);assert.equal(view.missions.find(m=>m.id==='upgrade').claimed,true);assert.equal(view.missions.find(m=>m.id==='staff-first').claimed,false);
 s.supporters=500;const before=s.money;apply(s,{id:'claim-fans',type:'claim',key:'fans-500'},0);apply(s,{id:'claim-fans',type:'claim',key:'fans-500'},0);assert.equal(s.money,before+500);assert.throws(()=>apply(s,{id:'second-claim',type:'claim',key:'fans-500'},0));
});
