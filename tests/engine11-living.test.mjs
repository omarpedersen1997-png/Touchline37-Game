import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';
import * as r3 from '../shared/football-engine11-r3.js';import {createArcade,stepArcade,replayArcade,getArcadeRules} from '../shared/arcade.js';
import {integrateLivingBall,moveLivingPlayer,receiveLivingBall,carryLivingBall} from '../shared/football-motion-r3.js';
import {createManualSession} from '../src/manual-session.js';import {createLivingCameraRig,livingCameraPlan} from '../src/living-camera.js';
import {matchCamera,screenToPitch} from '../src/match-camera.js';import {matchStatistics,matchStatisticText} from '../src/match-statistics.js';import {moneyNumber,moneyLabel} from '../src/format-money.js';
const config={matchVersion:11,engineRevision:3,homeRating:65,awayRating:62,formation:'4-3-3'};
const player=()=>({x:0,y:0,vx:0,vy:0,facingX:0,facingY:-1,gait:0,kick:0});
const ball=(kind='pass')=>({x:0,y:0,z:.22,vx:22,vy:0,vz:0,curl:0,flightKind:kind});
test('revision 2 stays byte frozen and revision 3 is explicit with the identical replay protocol',()=>{
 assert.equal(createHash('sha256').update(readFileSync('shared/football-engine11-r2.js')).digest('hex'),'4ad518a8d5fe454a76cbca4345f0f2294a1b6e7fddb3f98c9d17dad47d6d6f42');assert.equal(getArcadeRules(11,3),r3);assert.equal(createArcade('legacy',{matchVersion:11}).engineRevision,undefined);assert.equal(createArcade('old',{...config,engineRevision:2}).engineRevision,2);assert.equal(r3.INPUT_COUNT,5000);
});
test('all formations start still, with a centred ball, own halves, opponent distance and a real opening pass',()=>{
 for(const formation of ['4-3-3','4-4-2','3-5-2','4-5-1']){
  const s=createArcade('centre',{...config,formation});assert.deepEqual([s.ball.x,s.ball.y],[0,0]);assert.equal(s.freeze,24);assert(s.home.slice(1).every(p=>p.y>=0));assert(s.away.slice(1).every(p=>p.y<=0&&Math.hypot(p.x,p.y)>=9.15));
  for(let i=0;i<24;i++){stepArcade(s,0);assert.deepEqual([s.ball.x,s.ball.y],[0,0]);assert(s.home.every(p=>!p.vx&&!p.vy));}stepArcade(s,0);assert.equal(s.lastAction.kind,'pass');assert.equal(s.ball.flightKind,'pass');assert(s.ball.owner===null);assert(Math.hypot(s.ball.vx,s.ball.vy)>8);
 }
 const s=createArcade('half',config);s.tick=2599;s.period='halftime';stepArcade(s,0);assert.equal(s.half,2);assert.deepEqual([s.ball.x,s.ball.y],[0,0]);assert.equal(s.openingKickoff,'away');assert.equal(s.freeze,24);
});
test('ground and through passes slow differently while airborne balls arc, curve and lose bounce energy',()=>{
 const flat=ball(),through=ball('through');for(let i=0;i<30;i++){integrateLivingBall(flat);integrateLivingBall(through);}assert(through.x>flat.x);assert(through.vx>flat.vx);assert.equal(flat.z,.22);
 const air={...ball('loft'),vz:7,curl:1.2},straight={...air,curl:0};let peak=0,bounce=false,lastVz=7;
 for(let i=0;i<100;i++){integrateLivingBall(air);integrateLivingBall(straight);peak=Math.max(peak,air.z);if(lastVz<0&&air.vz>0){bounce=true;assert(air.vz<7);}lastVz=air.vz;assert(air.z>=.22);}
 assert(peak>2);assert(bounce);assert(Math.abs(air.y-straight.y)>.25);assert(Math.hypot(air.vx,air.vy)<22);
 const exact=ball('shot'),copy=r3.stepBallPhysics(exact);assert.equal(exact.x,0);assert(copy.x>0);assert.equal(copy.flightKind,'shot');
});
test('speed curves have bounded acceleration, smooth body turning and settle fully after release',()=>{
 const p=player();let lastSpeed=0;
 for(let i=0;i<60;i++){moveLivingPlayer(p,0,p.y-10,9);const speed=Math.hypot(p.vx,p.vy);assert(speed-lastSpeed<=.61);assert(speed<=9.001);lastSpeed=speed;}
 assert(lastSpeed>8.5);const before=Math.atan2(p.facingX,p.facingY);moveLivingPlayer(p,10,p.y,9);const change=Math.atan2(Math.sin(Math.atan2(p.facingX,p.facingY)-before),Math.cos(Math.atan2(p.facingX,p.facingY)-before));assert(Math.abs(change)<.24);
 for(let i=0;i<80;i++)moveLivingPlayer(p,p.x,p.y,0);assert.equal(p.vx,0);assert.equal(p.vy,0);const frozen={...p};moveLivingPlayer(p,10,10,9,false,0);assert.deepEqual(p,frozen);
});
test('first touch keeps bounded incoming momentum, responds to pressure and joins the running stride without teleporting',()=>{
 const p={...player(),vx:3,facingX:-1,facingY:0},soft={...ball(),x:.3,vx:20},pressed={...soft};receiveLivingBall(soft,p,{skill:90,pressure:10});receiveLivingBall(pressed,p,{skill:40,pressure:.6});assert(soft.vx>p.vx&&soft.vx<20);assert(pressed.vx>soft.vx);assert.equal(soft.x,.3);
 let prior=soft.x;for(let i=0;i<20;i++){p.x+=p.vx*.05;carryLivingBall(soft,p,p.x+.6,p.y,3,i/10);assert(Math.abs(soft.x-prior)<.5);assert(Math.hypot(soft.x-p.x,soft.y-p.y)<1.7);prior=soft.x;}
});
test('four-input catchup, saved restoration and full replay stay exactly identical for revision 3',()=>{
 const match={id:'living-packet',started:1000,ends:251000,manual:{version:11,seed:'living-full',config,expiresAt:86400000}},s=createManualSession(match,{now:1000}),direct=createArcade(match.manual.seed,config);
 for(let tick=1;tick<=5000;tick++){const mask=tick%113===0?r3.PASS:r3.directionMask(Math.sin(tick*.01),-1);s.advance(1000+tick*50,mask,{maxInputs:4});stepArcade(direct,mask);}assert.deepEqual(s.state,direct);assert.deepEqual(replayArcade(match.manual.seed,config,r3.decodeInputs(s.packet())),direct);
 const slow=createManualSession(match,{now:1000});while(!slow.complete){const before=slow.count;slow.advance(251000,0,{maxInputs:4});assert(slow.count-before<=4);}const neutral=replayArcade(match.manual.seed,config,new Uint16Array(5000));assert.deepEqual(slow.state,neutral);assert.equal(slow.packet(),r3.encodeInputs(new Uint16Array(5000)));
});
test('camera is centred at kickoff, leads play with a bounded lens and critical damping behaves consistently at 30/60/120 Hz',()=>{
 const s=createArcade('camera',config),start=matchCamera(s,'pro',2);assert.deepEqual(start.target,[0,.8,0]);s.freeze=0;delete s.openingKickoff;s.ball.owner=null;s.ball.vx=25;s.ball.vy=-20;s.ball.z=4;const plan=matchCamera(s,'pro',2),quiet=matchCamera(s,'pro',2,{reducedMotion:true});assert(plan.target[0]>quiet.target[0]);assert(plan.eye[1]<=start.eye[1]*1.081);
 const positions=[];for(const hz of [30,60,120]){const rig=createLivingCameraRig();rig.update(start,0);let pose;for(let i=0;i<hz;i++)pose=rig.update(plan,1/hz);positions.push([...pose.target]);assert(pose.target[0]<=plan.target[0]);}for(const p of positions)assert(Math.abs(p[0]-positions[0][0])<1e-8);
 assert.deepEqual(screenToPitch(1,0,'diagram'),{x:0,y:-1});assert.deepEqual(matchCamera({...s,engineRevision:2},'pro',2).fov,42);
});
test('possession does not round away a real opposition touch and money formatting is consistently Danish',()=>{
 const row=matchStatistics({homePossession:4648,awayPossession:17}).rows.find(r=>r.key==='possession');assert.equal(row.home,99.6);assert.equal(row.away,.4);assert.equal(matchStatisticText(row.home,true),'99,6 %');assert.equal(moneyLabel(1746443),'1.746.443 kr.');assert.equal(moneyNumber(250003),'250.003');assert.equal(moneyLabel(NaN),'0 kr.');
});
test('posts, crossbar and goals use the same ground plane and a scored goal returns to a centred opposing kickoff',()=>{
 function fixture(x,z){const s=createArcade('impact',config);s.freeze=0;delete s.openingKickoff;for(const team of ['home','away'])s[team].forEach((p,i)=>Object.assign(p,{x:-25+i*2,y:20,vx:0,vy:0,cooldown:80}));Object.assign(s.ball,{x,y:-47.5,z,vx:0,vy:-25,vz:0,owner:null,flightKind:'shot',shot:true,lastTeam:'home',lastTouch:{team:'home',index:10},lastShooter:{team:'home',index:10}});return s;}
 for(const [x,z] of [[3.98,.5],[0,2.4]]){const s=fixture(x,z);stepArcade(s,0);assert.equal(s.lastAction.kind,'woodwork');assert.equal(s.homeScore,0);assert(s.ball.vy>0);}
 const goal=fixture(0,.5);stepArcade(goal,0);assert.equal(goal.homeScore,1);assert.equal(goal.goalSequence.stage,'net');for(let i=0;i<65;i++)stepArcade(goal,0);assert.equal(goal.goalSequence.stage,'kickoff');assert.deepEqual([goal.ball.x,goal.ball.y],[0,0]);assert.equal(goal.ball.owner.team,'away');
});
test('120 FPS is explicit, locally versioned and does not disturb the existing match preferences',async()=>{
 const {readMatchRefresh,saveMatchRefresh}=await import('../src/match-refresh.js');const data=new Map([['touchline:match-display:v1','old display data']]),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};assert.equal(readMatchRefresh(storage),60);saveMatchRefresh(120,storage);assert.equal(readMatchRefresh(storage),120);assert.equal(data.get('touchline:match-display:v1'),'old display data');saveMatchRefresh(77,storage);assert.equal(readMatchRefresh(storage),120);assert.equal(readMatchRefresh({getItem:()=>'{corrupt'}),60);
});
test('optional referee whistles use Web Audio with safe gesture resume and persistent mute',async()=>{
 const {createMatchSound}=await import('../src/match-sound.js');let tones=0,created=0;const storage={getItem:()=>null,setItem(){}};
 class Audio {constructor(){created++;this.state='running';this.destination={};this.currentTime=0;}resume(){}close(){}createGain(){return{connect(){},disconnect(){},gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}}createOscillator(){tones++;return{connect(){},disconnect(){},frequency:{setValueAtTime(){},linearRampToValueAtTime(){}},start(){},stop(){}}}}
 const sound=createMatchSound({storage,Audio,hidden:()=>false});assert.equal(created,0);assert.equal(sound.whistle(),false);sound.toggle();assert.equal(created,1);assert(sound.whistle('kickoff'));assert(sound.whistle('halftime'));assert(sound.whistle('finished'));assert.equal(tones,6);sound.toggle();assert.equal(sound.whistle(),false);sound.dispose();
});
