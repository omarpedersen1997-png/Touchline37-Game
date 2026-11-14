import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGoalReplayBuffer,replayFrame} from '../src/goal-replay.js';
import {createArcade,stepArcade} from '../shared/football-tactics.js';

function fixture(tick=0){
 const s=createArcade('replay-fixture');s.tick=tick;s.freeze=0;
 s.ball.owner=null;s.ball.x=0;s.ball.y=-40;s.ball.z=.4;s.ball.vx=0;s.ball.vy=0;s.ball.vz=0;
 return s;
}
function actualGoalFrame(s,side='home'){
 s[side==='home'?'homeScore':'awayScore']++;
 s.events.push({minute:12,kind:'goal',side});
 s.lastGoal={tick:s.tick,time:1,side,point:{x:0,y:side==='home'?-48:48,z:.4},...structuredClone({home:s.home,away:s.away,ball:{...s.ball,x:0,y:side==='home'?-48:48,z:.4,owner:null},controlled:s.controlled})};
 // The real engine resets these positions immediately after the goal.
 s.ball.x=0;s.ball.y=1.2;s.ball.z=.22;s.freeze=20;
 return s;
}

test('an actual engine8 goal retains its genuine crossing and pre-kickoff poses for replay',()=>{
 const buffer=createGoalReplayBuffer(),s=createArcade('recorded-goal');
 for(const team of['home','away'])s[team].forEach((p,i)=>Object.assign(p,{x:24,y:team==='home'?32:-32,vx:0,vy:0,cooldown:1000,decision:1000}));
 Object.assign(s.ball,{owner:null,x:0,y:0,z:.22,vx:0,vy:0,vz:0,protected:0});buffer.capture(s);
 for(let i=0;i<60;i++){stepArcade(s,0);buffer.capture(s);}
 Object.assign(s.ball,{owner:null,x:0,y:-47.8,z:.4,vx:0,vy:-20,vz:0,shot:true,lastShooter:{team:'home',index:10},protected:0});
 stepArcade(s,0);assert.equal(s.homeScore,1);assert.equal(s.lastGoal.point.y,-48);assert.equal(Math.abs(s.ball.y),1.2);buffer.capture(s);assert.equal(buffer.clips.length,0,'wait for the tail interval before making the clip ready');
 const originalPose=s.lastGoal.home[10].x;
 for(let i=0;i<20;i++){stepArcade(s,0);buffer.capture(s);}
 const [clip]=buffer.clips;assert.equal(clip.kind,'goal');assert(clip.hasGoalFrame);assert.equal(clip.homeScore,1);assert.equal(clip.awayScore,0);assert.equal(clip.team,'home');assert(clip.frames.length<=33);
 const final=clip.frames.at(-1);assert.equal(final.state.ball.y,-48);assert.equal(final.state.home[10].x,originalPose);assert.equal(final.state.ball.owner,null);assert(!Object.hasOwn(final.state,'lastGoal'));
 s.home[10].x=99;s.lastGoal.home[10].x=77;s.lastGoal.ball.y=0;
 assert.equal(final.state.home[10].x,originalPose);assert.equal(final.state.ball.y,-48);assert(Object.isFrozen(final.state));assert(Object.isFrozen(final.state.home[10]));
 assert.throws(()=>{final.state.ball.y=7;},TypeError);
});

test('interpolation uses captured positions, shortest-facing turns and a held genuine endpoint without mutating match data',()=>{
 const buffer=createGoalReplayBuffer({tailMs:1000}),s=fixture();
 s.home[3].x=0;s.home[3].facingX=Math.sin(-Math.PI/18);s.home[3].facingY=Math.cos(-Math.PI/18);buffer.capture(s);
 s.tick=2;s.home[3].x=2;s.home[3].kick=8;s.home[3].facingX=Math.sin(Math.PI/18);s.home[3].facingY=Math.cos(Math.PI/18);s.ball.y=-42;buffer.capture(s);
 s.tick=4;s.home[3].x=4;s.ball.y=-47.8;actualGoalFrame(s);buffer.capture(s);buffer.finish(s);
 const clip=buffer.clips[0],canonical=JSON.stringify(s),frame=replayFrame(clip,50);
 assert.equal(frame.home[3].x,1);assert.equal(frame.home[3].kick,4);assert.equal(frame.ball.y,-41);assert(Math.abs(frame.home[3].facingX)<1e-10);assert(frame.home[3].facingY>.999);assert(frame.replay);assert(!frame.replayHold);assert.equal(frame.homeScore,0);
 frame.home[3].x=999;frame.ball.y=999;
 assert.equal(replayFrame(clip,50).home[3].x,1);assert.equal(JSON.stringify(s),canonical);
 const endpoint=replayFrame(clip,clip.durationMs);assert.equal(endpoint.ball.y,-48);assert.equal(endpoint.homeScore,1);assert(endpoint.replayHold);assert.equal(replayFrame(clip,-100).home[3].x,0);assert.equal(replayFrame(clip,Infinity).home[3].x,0);assert.equal(replayFrame(null,0),null);
});

test('rolling history and completed goal clips stay bounded throughout a long scoring match',()=>{
 const buffer=createGoalReplayBuffer({sampleMs:100,leadMs:1000,tailMs:200,maxClips:2}),s=fixture();buffer.capture(s);
 for(let tick=1;tick<=1600;tick++){
  s.tick=tick;s.freeze=0;s.ball.y=-40;s.ball.x=Math.sin(tick*.01);buffer.capture(s);
  if(tick%80===0){s.tick++;actualGoalFrame(s,tick%160===0?'away':'home');buffer.capture(s);}
  assert(buffer.clips.length<=2);assert(buffer.bufferedFrameCount<=12+2*13);
 }
 buffer.finish(s);assert.equal(buffer.clips.length,2);assert(buffer.clips[0].goalTime<buffer.clips[1].goalTime);assert(buffer.clips.every(c=>c.frames.length<=13));
 const list=buffer.clips;list.length=0;assert.equal(buffer.clips.length,2,'consumer list mutation cannot delete retained clips');
});

test('score-only changes, already-present goals and background gaps cannot invent footage',()=>{
 const buffer=createGoalReplayBuffer(),s=fixture();actualGoalFrame(s);buffer.capture(s);assert.equal(buffer.clips.length,0,'joining late does not replay an unseen goal');
 s.tick=2;s.homeScore=2;buffer.capture(s);buffer.finish(s);assert.equal(buffer.clips.length,0,'changing a score without a goal event is not a replay');
 buffer.reset();const afterGap=fixture();buffer.capture(afterGap);afterGap.tick=1000;actualGoalFrame(afterGap);buffer.capture(afterGap);buffer.finish(afterGap);assert.equal(buffer.clips.length,0,'do not interpolate through an unrecorded background interval');
});

test('legacy engines show honest build-up footage rather than synthesizing a missing goal crossing',()=>{
 const buffer=createGoalReplayBuffer({tailMs:0}),s=fixture();s.version=7;buffer.capture(s);s.tick=2;s.ball.y=-44;buffer.capture(s);s.tick=4;s.ball.y=-47.5;buffer.capture(s);
 s.tick=6;s.homeScore=1;s.events.push({kind:'goal',side:'home',minute:15});s.ball.y=1.2;s.freeze=20;buffer.capture(s);
 const clip=buffer.clips[0];assert.equal(clip.kind,'build-up');assert(!clip.hasGoalFrame);assert.equal(clip.frames.at(-1).state.ball.y,-47.5);assert.equal(replayFrame(clip,clip.durationMs).ball.y,-47.5);
});

test('finish flushes the last goal once, captures are ignored afterward, and reset starts a new recording',()=>{
 const buffer=createGoalReplayBuffer(),s=fixture();buffer.capture(s);s.tick=2;buffer.capture(s);s.tick=4;actualGoalFrame(s);buffer.capture(s);assert.equal(buffer.clips.length,0);
 assert(buffer.finish(s));assert.equal(buffer.clips.length,1);const before=buffer.bufferedFrameCount;assert.equal(buffer.finish(s),false);s.tick=100;assert.equal(buffer.capture(s),false);assert.equal(buffer.bufferedFrameCount,before);
 buffer.reset();assert.equal(buffer.clips.length,0);assert.equal(buffer.bufferedFrameCount,0);buffer.capture(fixture());assert.equal(buffer.bufferedFrameCount,1);
});

test('replay does not smooth a captured restart teleport into fictional ball travel',()=>{
 const buffer=createGoalReplayBuffer({tailMs:0}),s=fixture();buffer.capture(s);s.tick=2;s.freeze=10;s.restart={tick:2,kind:'throw-in'};s.ball.x=29;s.ball.y=-42;buffer.capture(s);s.tick=4;s.freeze=0;s.ball.x=28;buffer.capture(s);s.tick=6;actualGoalFrame(s);buffer.capture(s);
 const clip=buffer.clips[0];assert.equal(replayFrame(clip,50).ball.x,0);assert.equal(replayFrame(clip,100).ball.x,29);
});

function netGoalFrame(s,side='home'){
 const pose=structuredClone({home:s.home,away:s.away,ball:s.ball,controlled:s.controlled});
 actualGoalFrame(s,side);Object.assign(s,pose);s.version=10;s.freeze=0;
 s.ball.owner=null;s.ball.y=side==='home'?-48:48;
 s.goalSequence={stage:'net',startedTick:s.tick,elapsedTicks:0,stageTicks:0,team:side,scorer:10,assister:null,celebrants:[10],kickoffTeam:side==='home'?'away':'home',netSide:side==='home'?-1:1,point:{x:0,y:s.ball.y,z:s.ball.z},impact:null};
 return s;
}

test('new goal replays retain real net follow-through and never interpolate the later kickoff reset',()=>{
 const buffer=createGoalReplayBuffer(),s=fixture();s.version=10;buffer.capture(s);
 s.tick=2;s.ball.y=-47.5;buffer.capture(s);s.tick=3;netGoalFrame(s);buffer.capture(s);
 const start=s.goalSequence.startedTick;
 for(let i=1;i<18;i++){
  s.tick++;s.goalSequence.elapsedTicks=i;s.goalSequence.stageTicks=i;
  s.ball.y=-48-Math.min(i*.15,1.6);s.ball.z=Math.max(.22,.4-i*.015);
  if(i===11)s.goalSequence.impact={tick:s.tick,x:0,y:s.ball.y,z:s.ball.z,strength:.7,surface:'back'};
  buffer.capture(s);assert.equal(buffer.clips.length,0);
 }
 const lastBall=structuredClone(s.ball);s.tick++;s.goalSequence.stage='celebration';s.goalSequence.stageTicks=0;buffer.capture(s);
 const [clip]=buffer.clips;assert.equal(clip.kind,'goal');assert.equal(clip.sequenceStartedTick,start);assert.equal(clip.holdMs,350);
 assert(clip.frames.some(f=>f.state.ball.y<-49),'the ball really travels beyond the scoring line in retained footage');
 assert(clip.frames.some(f=>f.state.goalSequence?.impact?.surface==='back'),'a genuine net impact is retained');
 assert(clip.frames.every(f=>!f.state.goalSequence||f.state.goalSequence.stage==='net'));
 assert(clip.frames.at(-1).state.ball.y<=-49.5);assert(clip.endMs>clip.goalTime+700);
 const final=replayFrame(clip,clip.durationMs);assert.deepEqual(final.ball,lastBall);assert(final.replayHold);
 const before=JSON.stringify(clip);s.tick+=42;s.goalSequence.stage='kickoff';s.ball.y=1.2;s.freeze=24;buffer.capture(s);
 assert.equal(JSON.stringify(buffer.clips[0]),before,'the center-circle cut cannot enter an already completed net clip');
 const inFlight=replayFrame(clip,clip.goalTime-clip.startMs+450);assert(inFlight.ball.y<-48.5&&inFlight.ball.y>-49.6);assert(!inFlight.replayHold);
 s.goalSequence.impact.x=99;s.ball.y=0;assert.equal(JSON.stringify(buffer.clips[0]),before,'live state cannot mutate saved impact data or ball poses');
});

test('missing tail footage and halftime cuts end on the last observed real ball position',()=>{
 for(const interruption of['background','halftime','finish']){
  const buffer=createGoalReplayBuffer(),s=fixture();s.version=10;buffer.capture(s);s.tick=2;netGoalFrame(s);buffer.capture(s);
  s.tick+=2;s.ball.y=-48.3;s.goalSequence.elapsedTicks=2;s.goalSequence.stageTicks=2;buffer.capture(s);
  if(interruption==='background'){s.tick+=80;s.goalSequence.stage='kickoff';s.ball.y=1.2;buffer.capture(s);}
  else if(interruption==='halftime'){s.tick++;s.goalSequence=null;s.period='halftime';s.ball.y=1.2;buffer.capture(s);}
  else buffer.finish(s);
  const clip=buffer.clips[0];assert(clip,interruption);assert.equal(clip.frames.at(-1).state.ball.y,-48.3,interruption);
  assert.equal(replayFrame(clip,clip.durationMs).ball.y,-48.3);assert(clip.frames.every(f=>f.time<=200));
 }
});

test('net follow-through adds only a bounded tail to each retained clip during a high-scoring match',()=>{
 const buffer=createGoalReplayBuffer({leadMs:500,sampleMs:100,tailMs:1000,maxClips:2}),s=fixture();s.version=10;buffer.capture(s);
 for(let i=1;i<=1200;i++){
  s.tick=i;
  const phase=i%100;
  if(phase===20)netGoalFrame(s,i%200===20?'home':'away');
  else if(s.goalSequence&&phase>20&&phase<38){s.goalSequence.elapsedTicks++;s.goalSequence.stageTicks++;s.ball.y+=s.goalSequence.netSide*.05;}
  else if(s.goalSequence&&phase===38)s.goalSequence.stage='celebration';
  else if(s.goalSequence&&phase===80){s.goalSequence=null;s.ball.y=-40;}
  buffer.capture(s);assert(buffer.clips.length<=2);assert(buffer.bufferedFrameCount<=7+2*19);
 }
 buffer.finish(s);assert.equal(buffer.clips.length,2);assert(buffer.clips.every(clip=>clip.frames.length<=19));
});

test('an actual engine10 goal replay shows its physical ball reaching the net and stopping before kickoff',async()=>{
 const engine=await import('../shared/football-goals.js'),s=engine.createArcade('real-net-replay'),buffer=createGoalReplayBuffer();
 for(const team of['home','away'])s[team].forEach((p,i)=>Object.assign(p,{x:24,y:team==='home'?32:-32,vx:0,vy:0,cooldown:1000,decision:1000}));
 Object.assign(s.ball,{owner:null,x:0,y:0,z:.22,vx:0,vy:0,vz:0,protected:0});buffer.capture(s);
 for(let i=0;i<60;i++){engine.stepArcade(s,0);buffer.capture(s);}
 Object.assign(s.ball,{owner:null,x:.5,y:-47.8,z:.4,vx:0,vy:-20,vz:0,shot:true,lastShooter:{team:'home',index:10},protected:0});
 engine.stepArcade(s,0);buffer.capture(s);assert.equal(s.homeScore,1);assert.equal(s.goalSequence.stage,'net');
 while(s.goalSequence?.stage==='net'){engine.stepArcade(s,0);buffer.capture(s);}
 const [clip]=buffer.clips;assert(clip?.hasGoalFrame);assert(clip.frames.some(f=>Math.abs(f.state.ball.y)>48.5));
 assert(clip.frames.some(f=>f.state.goalSequence?.impact),'capture includes real impact rather than a synthetic terminal hold');
 assert(clip.frames.filter(f=>f.time>=clip.goalTime).every(f=>Math.abs(f.state.ball.y)>=48));assert.equal(replayFrame(clip,clip.durationMs).ball.owner,null);
 assert.equal(s.homeScore,1);assert.equal(s.events.filter(e=>e.kind==='goal').length,1);
});
