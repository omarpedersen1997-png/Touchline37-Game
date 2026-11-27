import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,kickOff,stepMatch,swapRoles,substitute,setTactics,PHASE,HALF_TICKS,timeLabel} from '../src/engine.js';
import {FIELD,STEP,integrateBall,kickBall,integratePlayBall,passSpeed,carryBall,cushionTouch} from '../src/physics.js';
import {createMatchLoop} from '../src/loop.js';
import {newClub,trainClub,loadClub,saveClub,nextMatch,settleMatch} from '../src/club.js';
import {SCENARIOS,scenarioMatch,scenarioResult} from '../src/scenarios.js';

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
test('short situations keep manual kickoff and never settle into the league',()=>{
  const club=newClub(),league=nextMatch(club);
  const saved=structuredClone(league);
  for(const scenario of SCENARIOS){
    const s=scenarioMatch(scenario);
    checkKickoff(s);
    assert.equal(timeLabel(s),scenario.minute+':00');
    assert.equal(s.phase,PHASE.KICKOFF_READY);
    assert.equal(stepMatch(s),false);
    assert.equal(scenarioResult(scenario,s),null);
    finish(s);
    assert.equal(timeLabel(s),'90:00');
    assert.equal(scenarioResult(scenario,s),scenario.result(s.teams[0].stats.goals-s.teams[1].stats.goals));
    assert.equal(settleMatch(club,s),null);
  }
  assert.deepEqual(club.active,saved);
  assert.equal(club.played,0);
});
test('the scenario objectives can be reached by changing the match plan',()=>{
  for(const [item,mentality] of [[SCENARIOS[0],'attack'],[SCENARIOS[1],'defend']]){
    const ordinary=scenarioMatch(item), changed=scenarioMatch(item);
    assert.ok(setTactics(changed,0,{mentality}));
    finish(ordinary);finish(changed);
    assert.equal(scenarioResult(item,ordinary),false);
    assert.equal(scenarioResult(item,changed),true);
  }
});

test('direct control steers the carrier and releases once on demand',()=>{
  for(const action of ['pass','through','shoot']){
    const s=createMatch();kickOff(s);
    const p=s.teams[0].players[9];
    Object.assign(s.ball,{owner:9,kind:'carry',age:1});
    const input={slot:9,x:0,y:1,sprint:true,action:''};
    for(let i=0;i<12;i++)stepMatch(s,{},input);
    assert.ok(p.y>.45);assert.equal(s.ball.owner,9);
    input.action=action;stepMatch(s,{},input);
    assert.equal(input.action,'');assert.equal(s.ball.owner,-1);
    assert.equal(s.ball.kind,action==='shoot'?'shot':'pass');
  }
});

test('fifteen settled fixtures determine promotion, relegation and league one title',()=>{
  for(const [division,wins,expected] of [[10,10,9],[2,10,1],[1,15,1],[4,0,5],[10,0,10],[5,6,5]]){
    const club=newClub();club.division=division;
    const opponents=new Set();
    for(let i=0;i<15;i++){
      const m=nextMatch(club);opponents.add(m.teams[1].name);m.phase=PHASE.FULL_TIME;
      m.teams[i<wins?0:1].stats.goals=1;
      const summary=settleMatch(club,m);
      if(i<14){assert.equal(club.division,division);assert.equal(club.round,i+1);}
      if(division===1&&i===14)assert.equal(summary.seasonResult,'Ligamester');
    }
    assert.equal(club.division,expected);assert.equal(club.round,0);
    assert.equal(club.seasonPoints,0);assert.equal(club.played,15);assert.equal(opponents.size,15);
  }
});

test('a user free kick waits for a fresh strike and puts four defenders in a wall',()=>{
  const s=createMatch();kickOff(s);
  s.ball.x=30;s.ball.y=2;
  s.phase=PHASE.DEAD_BALL;s.restart={kind:'free-kick',side:0,slot:7,end:s.tick+28};
  const input={x:1,y:0,action:'shoot',slot:7};
  for(let i=0;i<40;i++)stepMatch(s,{},input);
  assert.equal(s.phase,PHASE.DEAD_BALL);assert.equal(s.tick,0);
  for(const p of s.teams[1].players.slice(1,5))assert.ok(Math.hypot(p.x-s.ball.x,p.y-s.ball.y)>=9.15);
  input.action='shoot';stepMatch(s,{},input);
  assert.equal(s.phase,PHASE.PLAYING);assert.equal(s.ball.kind,'shot');
  assert.equal(s.teams[0].stats.shots,1);assert.equal(input.action,'');
});

test('manual ground passes of 8, 20 and 35 metres arrive at playable speeds and roll to rest',()=>{
  for(const [range,earliest,latest] of [[8,1.05,1.4],[20,1.95,2.35],[35,2.6,3.15]]){
    const b={x:0,y:0,z:.11};
    kickBall(b,range,0,passSpeed(range));
    let arrival=0;
    for(let tick=1;tick<=600;tick++){
      const speed=b.vx;
      integratePlayBall(b,STEP);
      assert.ok(b.vx<=speed && b.vx>=0);
      if(!arrival&&b.x>=range){
        arrival=tick*STEP;
        assert.ok(b.vx>4&&b.vx<8.5);
      }
    }
    assert.ok(arrival>earliest&&arrival<latest);
    assert.equal(b.vx,0);
    const stopped=b.x;integratePlayBall(b,STEP);assert.equal(b.x,stopped);
    assert.ok(passSpeed(range,true)>passSpeed(range));
  }
});

test('manual reception cushions the incoming ball without snapping it to the foot',()=>{
  const b={x:0,y:.62,z:.11,spin:.3,vx:15,vy:-2,vz:0};
  const p={x:0,y:0,vx:3,vy:0,fx:1,fy:0,skill:75,slot:7};
  cushionTouch(b,p);
  assert.deepEqual([b.x,b.y],[0,.62]);
  assert.ok(b.vx>p.vx&&b.vx<7);
  let min=Infinity,max=-Infinity;
  for(let tick=0;tick<110;tick++){
    if(tick===60){p.vx=0;p.vy=3;p.fx=0;p.fy=1;}
    p.x+=p.vx*STEP;p.y+=p.vy*STEP;
    const x=b.x,y=b.y;carryBall(b,p,STEP);
    assert.ok(Math.hypot(b.x-x,b.y-y)<.28);
    const distance=Math.hypot(b.x-p.x,b.y-p.y);
    assert.ok(distance<1.5);
    min=Math.min(min,distance);max=Math.max(max,distance);
  }
  assert.ok(max-min>.15);
});

test('manual shots curl, lose horizontal speed and bounce lower with each impact',()=>{
  const b={x:0,y:0,z:.11};
  kickBall(b,25,0,25,5.5,.26);
  const peaks=[];let peak=b.z;
  for(let i=0;i<150;i++){
    const vz=b.vz;integratePlayBall(b,STEP);
    peak=Math.max(peak,b.z);
    if(vz<0&&b.vz>=0){peaks.push(peak);peak=b.z;}
    assert.ok(b.z>=.11);
  }
  assert.ok(peaks.length>=2&&peaks[0]>1.4&&peaks[1]<peaks[0]*.5);
  assert.ok(b.y>1&&b.vx<25);
});

test('a manual save meets a shot before it crosses the line in the same tick',()=>{
  const s=createMatch();kickOff(s);
  const keeper=s.teams[1].players[0];
  Object.assign(keeper,{x:52.15,y:0,vx:0,vy:0});
  Object.assign(s.ball,{x:51.95,y:0,z:.8,vx:28,vy:0,vz:0,owner:-1,kind:'shot',age:.4,lastTeam:0});
  stepMatch(s,{}, {slot:9,x:0,y:0,action:''});
  assert.equal(s.teams[1].stats.saves,1);
  assert.equal(s.teams[0].stats.goals,0);
  assert.ok(s.ball.x<52.5);
});

test('manual ball motion is identical at 60 and 120 Hz and after a saved first touch',()=>{
  function play(hz){
    const s=createMatch();kickOff(s);
    const loop=createMatchLoop(s), input={slot:5,x:.5,y:0,sprint:false,action:''};
    for(let i=0;i<=hz*5;i++)loop.advance(i*1000/hz,1,input);
    return s;
  }
  assert.deepEqual(play(60),play(120));
  const s=createMatch();kickOff(s);
  const input={slot:-1,x:0,y:0,action:''};
  for(let n=0;n<150&&s.ball.owner<0;n++)stepMatch(s,{},input);
  assert.ok(s.ball.owner>=0);
  const saved=JSON.parse(JSON.stringify(s)), copy={...input};
  for(let n=0;n<90;n++){stepMatch(s,{},input);stepMatch(saved,{},copy);}
  assert.deepEqual(s,saved);
});

test('the Spil selv buttons launch a weighted pass, a leading through ball and a distinct shot',()=>{
  const strike=(action)=>{
    const s=createMatch(),team=s.teams[0],kicker=team.players[7],mate=team.players[9];
    for(const p of team.players){p.x=-30;p.y=-10;}
    Object.assign(kicker,{x:-.5,y:0});Object.assign(mate,{x:20,y:0,vx:0,vy:0});
    s.phase=PHASE.DEAD_BALL;s.restart={kind:'free-kick',side:0,slot:7,ready:true};
    stepMatch(s,{}, {x:1,y:0,slot:7,action});
    assert.equal(s.phase,PHASE.PLAYING);
    return s.ball;
  };
  const pass=strike('pass'), through=strike('through'), shot=strike('shoot');
  assert.equal(pass.target,9);assert.equal(through.target,9);
  assert.ok(Math.abs(pass.vx-12.48)<.01);
  assert.ok(through.vx>pass.vx+1.5&&through.vx<19);
  assert.ok(shot.vx>20&&shot.vx<30&&shot.vz>0);
});

test('a manual match reaches 90:00 with finite positions and bounded ball speed',()=>{
  const s=createMatch(),scratch={},input={slot:-1,x:0,y:0,sprint:false,action:''};
  let ticks=0;
  while(s.phase!==PHASE.FULL_TIME&&ticks++<6500){
    if(s.phase===PHASE.KICKOFF_READY||s.phase===PHASE.PRE_KICKOFF)kickOff(s);
    input.action=s.restart?.ready||s.ball.owner>=0&&s.ball.owner<11&&ticks%28===0?'pass':'';
    stepMatch(s,scratch,input);
    const b=s.ball;
    assert.ok(Number.isFinite(b.x+b.y+b.z+b.vx+b.vy+b.vz));
    assert.ok(Math.hypot(b.vx,b.vy)<36&&b.z>=.11);
  }
  assert.equal(s.phase,PHASE.FULL_TIME);
  assert.equal(timeLabel(s),'90:00');
});
