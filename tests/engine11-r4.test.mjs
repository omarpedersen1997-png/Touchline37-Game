import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,stepArcade,replayArcade,encodeInputs,decodeInputs,INPUT_COUNT,SUBSTITUTION_COMMAND,passSpeedFor} from '../shared/football-engine11-r4.js';
import {getArcadeRules} from '../shared/arcade.js';
import {identifyOffside,setPieceLayout,foulSeverity} from '../shared/football-rules-r4.js';
import {integrateMatchBall,dribbleStep} from '../shared/football-motion-r4.js';
import {r4PoseFrame,sampleR4Ball,sampleR4Player} from '../shared/football-pose-r4.js';
import {createR4Practice} from '../src/r4-practice.js';
import {createManualSession} from '../src/manual-session.js';
import {createR4CameraPlan} from '../src/broadcast-r4.js';
import {createMatchEventFeed} from '../src/match-event-feed.js';

const config={matchVersion:11,engineRevision:4,formation:'4-3-3',homeRating:65,awayRating:61};
const match=()=>createArcade('r4-regression',config);
function playing(){
 const state=match();
 state.tick=29;state.period='first';state.freeze=0;
 delete state.openingKickoff;
 return state;
}
function space(state,touchTeam='home'){
 for(const team of ['home','away'])state[team].forEach((p,i)=>{
  p.x=(team==='home'?-21:21)+(i%3-1)*2;p.y=(team==='home'?1:-1)*(12+Math.floor(i/3)*5);
  p.vx=p.vy=p.ax=p.ay=0;
 });
 Object.assign(state.ball,{owner:null,x:29.8,y:0,z:.3,vx:22,vy:0,vz:0,protected:0,lastTeam:touchTeam});
}

test('R4 practice uses an isolated fixed clock and keeps the standard dispatcher frozen',()=>{
 assert.throws(()=>getArcadeRules(11,4),/revisionen understøttes ikke/);
 const p=createR4Practice(5000);
 assert.equal(p.now(345),5000);
 p.pause(false,345);assert.equal(p.now(395),5050);
 p.pause(true,410);assert.equal(p.now(10000),5065);
 p.pause(false,10000);assert.equal(p.now(10600),5665);
 assert.equal(createR4Practice(5000).storage.length,0);
});

test('the same complete match at 30, 60 and 120 render opportunities has identical state and input bytes',()=>{
 const results=[];
 for(const fps of [30,60,120]){
  const p=createR4Practice(1000);
  const session=createManualSession(p.match,{storage:p.storage,practiceRules:p.rules,now:p.match.started});
  const elapsed=p.match.manual.duration;
  for(let n=1;n<=Math.ceil(elapsed*fps/1000);n++){
   const time=Math.min(elapsed,n*1000/fps);
   session.advance(p.match.started+time,0,{maxInputs:4});
   const state=session.state, frame=r4PoseFrame(state);
   const ball=sampleR4Ball(state,frame,.5,{});
   assert(Number.isFinite(ball.x)&&Number.isFinite(ball.y)&&ball.z>=.219);
  }
  assert(session.complete);assert.equal(session.state.period,'finished');
  const packet=session.packet();
  assert.equal(decodeInputs(packet).length,INPUT_COUNT);
  results.push([packet,session.state]);
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
 assert.deepEqual(replayArcade('touchline-r4-1000',config,new Uint16Array(INPUT_COUNT)),results[0][1]);
});

test('revised 3D ball curls in opposite directions, bounces and loses energy',()=>{
 const start={x:0,y:0,z:.22,vx:0,vy:-29,vz:5,flightKind:'loft'};
 const left={...start,curl:5},right={...start,curl:-5};
 let bounced=false, descending=false;
 for(let i=0;i<80;i++){
  integrateMatchBall(left);integrateMatchBall(right);
  descending||=left.vz<0;
  bounced||=descending&&left.vz>.05;
  assert(left.z>=.219&&right.z>=.219);
 }
 assert(bounced);
 assert(left.x>1&&right.x<-1);
 assert(Math.hypot(left.vx,left.vy)<29);
 assert(passSpeedFor(28,true)>passSpeedFor(12,false));
});

test('dribble rolls forward independently between touches and can escape a bad turn',()=>{
 const ball={x:0,y:0,z:.22,vx:9,vy:0,vz:0,protected:0,touchCountdown:3};
 const player={x:0,y:0,vx:0,vy:0,facingX:-1,facingY:0};
 assert(dribbleStep(ball,player,-.75,0,0,65));
 assert(ball.x>0);
 player.x=-.9;player.vx=-9;
 assert(dribbleStep(ball,player,-1.65,0,9,65));
 assert.equal(dribbleStep(ball,player,-1.65,0,9,65),false);
});

test('kickoff and halftime restart at the centre with an automatic backward pass',()=>{
 const s=match();
 assert.equal(s.ball.y,0);assert(s.away.slice(1).every(p=>Math.hypot(p.x,p.y)>=9.15&&p.y<0));
 for(let i=0;i<25;i++)stepArcade(s,0);
 assert(s.ball.vy>0);
 s.tick=2599;s.period='halftime';stepArcade(s,0);
 assert.equal(s.openingKickoff,'away');assert.deepEqual([s.ball.x,s.ball.y],[0,0]);assert(s.home.every(p=>p.y>=0));
});

test('throw, corner and goal kick resume within fixed ticks without moving the match clock backwards',()=>{
 for(const kind of ['throw-in','corner','goal-kick']){
  const s=playing();space(s,kind==='corner'?'away':'home');
  if(kind!=='throw-in')Object.assign(s.ball,{x:13,y:-47.7,vx:0,vy:-23});
  stepArcade(s,0);assert.equal(s.restart?.kind,kind);
  const deadline=s.tick+s.freeze+1;
  while(s.tick<deadline)stepArcade(s,0);
  assert.equal(s.restart?.released,true);
  assert.equal(s.ball.owner,null);
  if(kind==='throw-in')assert(s.ball.z>1.4);
 }
});

test('offside uses the ball and second-last defender and is called only on player involvement',()=>{
 const s=playing();space(s);
 Object.assign(s.ball,{x:0,y:-21,z:.22,vx:0,vy:-16,lastTeam:'home'});
 for(let i=0;i<11;i++){s.away[i].x=20;s.away[i].y=i===0?-45:-26;}
 Object.assign(s.home[9],{x:0,y:-31,facingX:0,facingY:1});
 const mask=identifyOffside(s,'home',10);
 assert(mask&(1<<9));assert.equal(identifyOffside(s,'home',10,'corner'),0);
 Object.assign(s.ball,{x:0,y:-30,z:.22,vx:0,vy:-15,offsideMask:mask,offsideTeam:'home'});
 stepArcade(s,0);
 assert(s.restart?.kind==='offside'||!s.refereeEvents.some(e=>e.kind==='offside'));
 if(!s.restart) for(let i=0;i<5;i++)stepArcade(s,0);
 assert.equal(s.restart?.kind,'offside');assert(s.restart.indirect);
});

test('distant motions and ball-first tackles are no foul, while a fast tackle from behind is punishable',()=>{
 const victim={x:0,y:0,vx:0,vy:-2,facingX:0,facingY:-1};
 const player={x:0,y:.9,vx:0,vy:-11};
 assert.equal(foulSeverity(player,victim,{x:0,y:-.65},true),3);
 assert.equal(foulSeverity({...player,y:4},victim,{x:0,y:-.65},true),0);
 assert.equal(foulSeverity(player,victim,{x:0,y:.82},true),0);
});

test('near free kick has four defenders in the wall and penalty puts other players outside the area',()=>{
 const s=match();
 for(const kind of ['free-kick','penalty']){
  s.restart={kind};
  const spot={x:0,y:kind==='penalty'?-37:-28};
  setPieceLayout(s,'home',kind,spot,10);
  if(kind==='free-kick'){
   const wall=s.away.filter(p=>p.role==='wall');
   assert.equal(wall.length,4);assert(wall.every(p=>Math.hypot(p.x-spot.x,p.y-spot.y)>=9.15));
  }else{
   assert.equal(s.away[0].x,0);assert(s.away[0].y<-47.7);
   assert(s.away.slice(1).every(p=>p.y>=-31.5));
   assert(s.home.every((p,i)=>i===10||p.y>=-31.5));
  }
 }
});

test('substitution is serialized in R4 only, replaces a lineup slot and is bounded',()=>{
 const s=match();s.home[4].energy=8;s.home[4].booking=1;
 stepArcade(s,SUBSTITUTION_COMMAND);
 assert.equal(s.home[4].shirt,12);assert.equal(s.home[4].energy,100);assert.equal(s.home[4].booking,0);
 for(let i=0;i<6;i++)stepArcade(s,SUBSTITUTION_COMMAND);
 assert.equal(s.substitutions.home,3);
 const tape=new Uint16Array(INPUT_COUNT);tape[0]=SUBSTITUTION_COMMAND;
 assert.equal(decodeInputs(encodeInputs(tape))[0],SUBSTITUTION_COMMAND);
 assert.equal(getArcadeRules(11,3).validateMask(SUBSTITUTION_COMMAND),false);
});

test('render pose uses reusable bounded interpolation and camera selection does not mutate simulation',()=>{
 const s=playing();space(s);const frameCopy={...s.ball};
 stepArcade(s,0);
 assert.equal(r4PoseFrame(s),null,'restart is a cut');
 for(let n=0;n<20;n++)stepArcade(s,0);
 const pose=r4PoseFrame(s);
 assert(pose);
 const existing={};assert.equal(sampleR4Player(s,pose,'home',0,.5,existing),existing);
 const plan=createR4CameraPlan(),before=structuredClone(s);
 const broadcast=[...plan(s,'broadcast',2,s.ball,s.home[s.controlled]).eye];
 const tactical=[...plan(s,'tactical',2,s.ball,s.home[s.controlled]).eye];
 assert(tactical[1]>broadcast[1]*2);assert.deepEqual(s,before);assert.notDeepEqual(s.ball,frameCopy);
 const feed=createMatchEventFeed();feed.observe(s);s.refereeEvents.push({tick:s.tick+1,kind:'yellow-card',side:'away',text:'Gult kort'});s.tick++;
 assert.equal(feed.observe(s)[0].kind,'yellow-card');
 assert.equal(feed.observe(s).length,1);
});
