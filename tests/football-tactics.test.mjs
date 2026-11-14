import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../shared/football-tactics.js';
import * as previous from '../shared/football-contact.js';
const {TACTICAL_COMMANDS:commands}=game;
const advance=(s,n,mask=0)=>{for(let i=0;i<n;i++)game.stepArcade(s,mask);};

test('engine8 accepts only seven enumerated tactical commands without growing the uint16 packet',()=>{
 assert.equal(game.ARCADE_VERSION,8);assert.equal(previous.ARCADE_VERSION,7);assert.equal(game.INPUT_COUNT,5000);assert.equal(game.DURATION_MS,250000);
 assert.deepEqual(Object.values(commands),Array.from({length:7},(_,i)=>32769+i));
 for(const key of game.TACTICS)assert.equal(game.commandForTactic(key),commands[key]);for(const key of game.FORMATIONS)assert.equal(game.commandForFormation(key),commands[key]);
 assert.equal(game.commandForTactic('4-4-2'),null);assert.equal(game.commandForFormation('attacking'),null);assert.equal(game.commandForFormation('__proto__'),null);
 for(const command of Object.values(commands)){assert(game.validateMask(command));assert(!previous.validateMask(command));assert(!game.validateMask(command|game.SHOOT));assert(!game.validateMask(command|game.directionMask(1,0)));}
 for(const mask of[32768,32776,33000,65535,-1,1.5,NaN])assert(!game.validateMask(mask),String(mask));
 const tape=new Uint16Array(5000);Object.values(commands).forEach((command,i)=>tape[i]=command);const encoded=game.encodeInputs(tape);assert.equal(encoded.length,13336);assert.deepEqual(game.decodeInputs(encoded),tape);
 const bytes=new Uint8Array(10000);bytes[0]=8;bytes[1]=128;assert.throws(()=>game.decodeInputs(btoa(String.fromCharCode(...bytes))));
});

test('formation commands during the interval change only home anchors, keeping identities and actual positions',()=>{
 const s=game.createArcade('interval',{formation:'4-3-3',personalPosition:'MID'});advance(s,2400);assert.equal(s.period,'halftime');
 const before=s.home.map(p=>structuredClone(p)),away=structuredClone(s.away),ball=structuredClone(s.ball),identities=[...s.home],controlled=s.controlled;
 game.stepArcade(s,commands['3-5-2']);assert.equal(s.formation,'3-5-2');assert.equal(s.tick,2401);assert.equal(s.half,1);assert.equal(s.period,'halftime');assert.equal(s.controlled,controlled);assert.deepEqual(s.away,away);assert.deepEqual(s.ball,ball);
 const expected=game.createArcade('shape',{formation:'3-5-2'}).positions;assert.deepEqual(s.positions,expected);
 s.home.forEach((p,i)=>{assert.equal(p,identities[i]);assert.equal(p.homeX,expected[i][0]);assert.equal(p.homeY,expected[i][1]);const a={...p},b={...before[i]};delete a.homeX;delete a.homeY;delete b.homeX;delete b.homeY;assert.deepEqual(a,b);});
 assert.equal(s.stats.tacticalChanges,1);game.stepArcade(s,commands['3-5-2']);assert.equal(s.stats.tacticalChanges,1,'reselecting active shape is a no-op');
 game.stepArcade(s,commands.attacking);assert.equal(s.tactic,'attacking');assert.equal(s.stats.tacticalChanges,2);assert.equal(s.lastTacticalChange.tick,2403);
 advance(s,197);assert.equal(s.period,'second');assert.equal(s.half,2);assert.equal(s.formation,'3-5-2');
});

test('a live formation command consumes a normal neutral tick and never teleports a player or changes the opposition shape',()=>{
 const s=game.createArcade('live',{formation:'4-3-3',personalPosition:'ANG'}),before=s.home.map(p=>({x:p.x,y:p.y})),awayShape=structuredClone(s.awayPositions),ids=[...s.home],owner={...s.ball.owner};
 game.stepArcade(s,commands['4-5-1']);assert.equal(s.tick,1);assert.equal(s.lastMask,0);assert.equal(s.formation,'4-5-1');assert.deepEqual(s.awayPositions,awayShape);assert.deepEqual(s.ball.owner,owner);assert.equal(s.controlled,s.personalIndex);
 s.home.forEach((p,i)=>{assert.equal(p,ids[i]);assert(Math.hypot(p.x-before[i].x,p.y-before[i].y)<.6);});assert.equal(s.homeScore+s.awayScore,0);
});

test('attacking and defensive live commands produce different supporting runs with the same seed and initial carrier',()=>{
 const a=game.createArcade('intent',{personalPosition:'ANG'}),d=game.createArcade('intent',{personalPosition:'ANG'});
 for(const s of[a,d]){s.ball.protected=10000;for(const p of s.away){p.x=28;p.y=-42;p.cooldown=1000;}}
 game.stepArcade(a,commands.attacking);game.stepArcade(d,commands.defensive);advance(a,140);advance(d,140);
 assert.equal(a.tactic,'attacking');assert.equal(d.tactic,'defensive');assert(a.home[8].y<d.home[8].y-2,'attacking forward support must commit farther toward the opponent goal');
});

test('recorded tactical/formation changes replay deterministically through both halves and are ignored after full time',()=>{
 const tape=Uint16Array.from({length:5000},(_,i)=>game.directionMask(Math.sin(i*.03),-Math.cos(i*.03))|(i%71===0?game.SHOOT:0)|(i%53===0?game.PASS:0));
 for(const [i,command]of[[20,commands.defensive],[800,commands['4-4-2']],[2404,commands.attacking],[2500,commands['3-5-2']],[3400,commands.balanced],[4700,commands['4-5-1']]])tape[i]=command;
 const s=game.createArcade('tactical-replay',{personalPosition:'MID'});for(const mask of tape)game.stepArcade(s,mask);
 assert.deepEqual(game.replayArcade('tactical-replay',{personalPosition:'MID'},game.decodeInputs(game.encodeInputs(tape))),s);assert.equal(s.period,'finished');assert.equal(s.tick,5000);assert.equal(s.formation,'4-5-1');assert.equal(s.tactic,'balanced');assert.equal(s.controlled,s.personalIndex);assert.equal(s.stats.tacticalChanges,6);
 const finished=structuredClone(s);game.stepArcade(s,commands.attacking);assert.deepEqual(s,finished);
});

test('engine7 contact results remain exactly reproducible when engine8 has no tactical commands',()=>{
 const tape=Uint16Array.from({length:5000},(_,i)=>game.directionMask(Math.sin(i*.04),-1)|(i%61===0?game.SHOOT:0)|(i%37===0?game.PASS:0));
 const config={formation:'4-4-2',personalPosition:'MID'},a=game.replayArcade('unchanged-contact',config,tape),b=previous.replayArcade('unchanged-contact',config,tape);
 assert.equal(a.homeScore,b.homeScore);assert.equal(a.awayScore,b.awayScore);assert.deepEqual(a.events,b.events);assert.deepEqual(a.lastContact,b.lastContact);
 for(const key of Object.keys(b.stats))assert.equal(a.stats[key],b.stats[key],key);
 for(const team of['home','away'])a[team].forEach((p,i)=>{for(const key of Object.keys(b[team][i]))assert.deepEqual(p[key],b[team][i][key],team+' '+i+' '+key);});
 assert.equal(a.stats.homePassAttempts,a.stats.passes);assert(a.stats.homeCompletedPasses<=a.stats.homePassAttempts);assert(a.stats.awayCompletedPasses<=a.stats.awayPassAttempts);assert.equal(a.stats.homeTackles,a.stats.tackles);
});

test('lastGoal retains one real line-crossing snapshot before kickoff rather than a fabricated goal scene',()=>{
 const s=game.createArcade('goal-view');s.ball.owner=null;Object.assign(s.ball,{x:0,y:-47.9,z:.4,vx:0,vy:-20,vz:0,protected:0,lastTouch:{team:'home',index:10},lastTouchTick:-100,lastShooter:{team:'home',index:10}});
 for(const team of['home','away'])s[team].forEach((p,i)=>Object.assign(p,{x:-28+i*4,y:team==='home'?30:-30,vx:0,vy:0,cooldown:1000}));
 game.stepArcade(s,0);assert.equal(s.homeScore,1);assert(s.lastGoal);assert.equal(s.lastGoal.point.y,-48);assert(s.lastGoal.time>=0&&s.lastGoal.time<=1);assert.equal(s.lastGoal.ball.y,-48);assert.equal(s.lastGoal.ball.owner,null);assert.equal(s.lastGoal.homeScore,1);assert.notEqual(s.ball.y,-48,'current ball is already at kickoff');assert.notEqual(s.lastGoal.home,s.home);assert.equal(s.lastGoal.lastGoal,undefined);
 const captured=structuredClone(s.lastGoal);advance(s,30);assert.deepEqual(s.lastGoal,captured);assert.equal(s.lastGoal.home.length,11);assert.equal(s.lastGoal.away.length,11);
});
