import{test}from'node:test';import assert from'node:assert/strict';
import{createArcade,stepArcade,replayArcade,encodeInputs,decodeInputs,INPUT_COUNT,DURATION_MS}from'../shared/arcade.js';
import{createGame,apply,settle,publicState}from'../worker/game.js';
import{playerCareerAction,playerCareerView,settlePlayerCareer}from'../worker/player-career.js';
const bytes=Uint8Array.from({length:INPUT_COUNT},(_,i)=>i<55?65:i%40===0?80:3),packet=encodeInputs(bytes);
const action=(s,id,type,time,extra={})=>apply(s,{id,type,...extra},time);
test('arcade replay is deterministic, bounded, finite and round-trips packed controls',()=>{
 assert.deepEqual(decodeInputs(packet),bytes);const a=replayArcade('same',{homeRating:60,awayRating:55},bytes),b=replayArcade('same',{homeRating:60,awayRating:55},bytes);assert.deepEqual(a,b);assert.equal(a.tick,1200);assert(a.stats.homeShots>0);assert(a.homeScore>0);assert.equal(a.events.length,a.homeScore+a.awayScore);
 for(const p of [...a.home,...a.away]){assert(Math.abs(p.x)<=19);assert(Math.abs(p.y)<=30);assert(Number.isFinite(p.energy));}
 assert(!/NaN|Infinity/.test(JSON.stringify(a)));const state=createArcade('end');state.tick=1200;const before=structuredClone(state);stepArcade(state,0);assert.deepEqual(state,before);
});
test('malformed, oversized and reserved controls cannot become a valid replay',()=>{
 for(const input of ['',packet+'A','='.repeat(800),null,{},encodeInputs(new Uint8Array(INPUT_COUNT).fill(255)),encodeInputs(new Uint8Array(INPUT_COUNT).fill(9))])assert.throws(()=>decodeInputs(input));
 const s=createArcade('input');for(const mask of [-1,128,NaN,1.5,9,15])assert.throws(()=>stepArcade(s,mask));
});
test('personal positions retain the same controlled player rather than silently controlling teammates',()=>{
 for(const[role,index]of[['ANG',4],['MID',3],['FOR',1],['MÅL',0]]){const state=replayArcade('personal',{personalPosition:role},bytes);assert.equal(state.personalIndex,index);assert.equal(state.controlled,index);assert(state.stats.userGoals<=state.homeScore);assert(state.stats.userAssists<=state.homeScore);if(role==='MÅL')assert(state.stats.userSaves>=0);}
});
test('a manual league game waits for a validated replay, ignores forged scores and pays once',()=>{
 const s=createGame(0),bank=s.money;action(s,'manual','match',0,{control:'manual'});const m=structuredClone(s.active);
 assert(m.manual);assert.equal(m.ends,DURATION_MS);assert.equal(publicState(s,0).active.reward,undefined);
 assert.equal(settle(s,DURATION_MS),null);assert(s.active);assert.equal(s.played,0);
 assert.throws(()=>action(s,'early','manual-match-finish',DURATION_MS-1,{matchId:m.id,inputs:packet}),/færdig/);
 const expected=replayArcade(m.manual.seed,m.manual.config,bytes);
 const result=action(s,'finish','manual-match-finish',DURATION_MS,{matchId:m.id,inputs:packet,home:999,away:0});assert(result.manualResult);
 assert.equal(s.history[0].home,expected.homeScore);assert.equal(s.history[0].away,expected.awayScore);assert.equal(s.played,1);assert.equal(s.money,bank+s.history[0].reward);
 const paid=s.money,again=action(s,'retry','manual-match-finish',DURATION_MS+1,{matchId:m.id,inputs:packet});assert.equal(again.manualResult.id,m.id);assert.equal(s.money,paid);assert.equal(s.played,1);
});
test('expired hands-on games are recorded as an explicit 0–3 forfeit with no reward',()=>{
 const s=createGame(0);action(s,'abandoned','match',0,{control:'manual'});const expires=s.active.manual.expiresAt;
 assert.equal(settle(s,expires-1),null);const m=settle(s,expires);assert(m.forfeited);assert.equal(m.home,0);assert.equal(m.away,3);assert.equal(m.reward,0);assert.equal(s.money,1500);assert.equal(s.played,1);assert.equal(settle(s,expires+1),null);
});
test('simulated games keep their existing duration and settlement behaviour',()=>{
 const s=createGame(0);action(s,'sim','match',0);assert.equal(s.active.ends,36000);assert.equal(s.active.manual,undefined);assert(settle(s,36000));assert.equal(s.played,1);
});
test('manual personal games use the player position and validate contributions without changing club standings',()=>{
 const s=createGame(0);playerCareerAction(s,{id:'p',type:'player-career-create',position:'MID',name:'Player',journeyVersion:1},0);
 playerCareerAction(s,{id:'pm',type:'player-career-match',control:'manual',journeyVersion:1},0);const m=structuredClone(s.playerCareer.active);
 assert.equal(m.manual.config.personalPosition,'MID');assert.equal(playerCareerView(s,0).active.result,undefined);assert.equal(playerCareerView(s,0).active.salary,undefined);
 assert.equal(settlePlayerCareer(s,DURATION_MS),null);assert.equal(s.playerCareer.stats.matches,0);
 assert.throws(()=>playerCareerAction(s,{id:'early',type:'player-career-manual-finish',matchId:m.id,inputs:packet},DURATION_MS-1),/færdig/);
 playerCareerAction(s,{id:'done',type:'player-career-manual-finish',matchId:m.id,inputs:packet,home:999},DURATION_MS);
 assert.equal(s.playerCareer.stats.matches,1);assert.equal(s.playerCareer.wallet,250);assert.equal(s.played,0);assert.equal(s.money,1500);assert(s.playerCareer.history[0].manual);
 playerCareerAction(s,{id:'retry',type:'player-career-manual-finish',matchId:m.id,inputs:packet},DURATION_MS+1);assert.equal(s.playerCareer.wallet,250);
});
test('only one personally controlled game can run at a time across the two careers',()=>{
 const s=createGame(0);playerCareerAction(s,{id:'p',type:'player-career-create',position:'ANG',name:'Player',journeyVersion:1},0);action(s,'club','match',0,{control:'manual'});
 assert.throws(()=>playerCareerAction(s,{id:'personal',type:'player-career-match',control:'manual',journeyVersion:1},0),/klubbens/);
});

test('an expired personal manual career match records zero salary, XP and contribution',()=>{
 const s=createGame(0);playerCareerAction(s,{id:'p',type:'player-career-create',position:'FOR',name:'Player',journeyVersion:1},0);playerCareerAction(s,{id:'pm',type:'player-career-match',control:'manual',journeyVersion:1},0);const expires=s.playerCareer.active.manual.expiresAt;
 assert.equal(settlePlayerCareer(s,expires-1),null);settlePlayerCareer(s,expires);const record=s.playerCareer.history[0];assert(record.forfeited);assert.equal(record.salary,0);assert.equal(record.xp,0);assert.equal(record.goals,0);assert.equal(s.playerCareer.wallet,100);assert.equal(s.playerCareer.stats.matches,1);assert.equal(s.played,0);
});
test('personal reading and fitness affect physical interceptions and sprint while identical snapshots stay deterministic',()=>{
 const low=createArcade('readiness',{personalPosition:'ANG',fitness:25,reading:40}),fresh=createArcade('readiness',{personalPosition:'ANG',fitness:100,reading:90});stepArcade(low,65);stepArcade(fresh,65);assert(low.home[4].energy<fresh.home[4].energy);assert.equal(low.skills.reading,40);assert.equal(fresh.skills.reading,90);
});
test('choosing the new manual mode activates energy rules even when a client omits the journey flag',()=>{
 const s=createGame(0);playerCareerAction(s,{id:'legacy',type:'player-career-create',position:'ANG',name:'Player'},0);assert.equal(s.playerCareer.journey.enabled,false);playerCareerAction(s,{id:'hands-on',type:'player-career-match',control:'manual'},0);assert.equal(s.playerCareer.journey.enabled,true);assert(s.playerCareer.journey.fitness<100);assert.equal(s.playerCareer.active.manual.config.fitness,100);
});
test('club tactics are snapshotted and alter off-ball behaviour in the played mode',()=>{
 const s=createGame(0);apply(s,{id:'tactic',type:'tactic',key:'defensive'},0);apply(s,{id:'manual-tactic',type:'match',control:'manual'},0);assert.equal(s.active.manual.config.tactic,'defensive');const balanced=replayArcade('tactics',{tactic:'balanced'},new Uint8Array(INPUT_COUNT)),attacking=replayArcade('tactics',{tactic:'attacking'},new Uint8Array(INPUT_COUNT));assert.notDeepEqual(balanced.home,attacking.home);
});
