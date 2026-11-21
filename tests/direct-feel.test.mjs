import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createInputOwnership,createInputLatencyTracker,createChargeFeedback,createCriticalHudGate,consumeDirectOneShots} from '../src/direct-match-input.js';
import {createJoystickProjector} from '../src/match-joystick.js';
import {matchControlMask} from '../src/manual-preferences.js';
import {createLocomotionSelector,sampleFootballAction} from '../src/player-action-sample.js';
import {safeMatchPrediction} from '../src/match-prediction.js';
import {livingCameraPlan,createLivingCameraRig} from '../src/living-camera.js';
import {createManualSession} from '../src/manual-session.js';
import {createArcade,replayArcade,getArcadeRules} from '../shared/arcade.js';
import {commandForTactic} from '../shared/football-tactics.js';
import {createMatchPerformanceLog} from '../src/match-performance-log.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createFootballPlayer,animateFootballPlayer} from '../src/pro-player.js';
import {createAssetPlayerAnimation} from '../src/asset-player-animation.js';
import {createFootballSwing} from '../src/football-swing.js';
import {matchPhase,MATCH_PHASE} from '../src/match-flow.js';
import {createGoalAudioObserver} from '../src/match-audio-feed.js';
const config={matchVersion:11,engineRevision:3,homeRating:65,awayRating:62,formation:'4-3-3'};

test('independent fingers retain joystick/sprint/action ownership and release/reset feedback without layout work',()=>{
 const owners=createInputOwnership(),joy={dataset:{}},sprint={dataset:{}},shoot={dataset:{}};
 assert(!owners.owns('joystick',undefined));assert(owners.claim('joystick',1,joy));assert(owners.claim('sprint',2,sprint));assert(owners.claim('shoot',3,shoot));assert(!owners.claim('joystick',4,joy));
 assert.equal(joy.dataset.inputDown,'true');assert(!owners.release('joystick',2));assert(owners.owns('joystick',1));assert(owners.release('shoot',3));assert(!shoot.dataset.inputDown);assert(sprint.dataset.inputDown);
 owners.clear('sprint');assert(!owners.release('sprint',2));owners.reset();assert.deepEqual(joy.dataset,{});assert(!owners.owns('joystick',1));
});
test('R3 thumb hysteresis starts promptly, resists centre jitter and preserves full-range rotated axes',()=>{
 let reads=0;const element={getBoundingClientRect(){reads++;return{left:0,top:0,width:120,height:120}}},radius=120*.36,project=createJoystickProjector({responsive:true});project.begin(element);
 assert.deepEqual(project.project(element,60+radius*.13,60),{x:0,y:0});const active=project.project(element,60+radius*.15,60);assert(active.x>=.2);assert.equal(active.y,0);assert(project.project(element,60+radius*.11,60).x>=.2);assert.deepEqual(project.project(element,60+radius*.08,60),{x:0,y:0});
 for(let i=0;i<100;i++){const p=project.project(element,500,-500);assert(Math.hypot(p.x,p.y)<=1.000001);}assert.equal(reads,1);
 const full=project.project(element,500,60),controls={...full,shoot:false,pass:false,sprint:false};assert.equal(matchControlMask(new Set(),controls,'pro',11),matchControlMask(new Set(),{...controls,x:1,y:0},'pro',11));
 project.reset();assert.deepEqual(project.project(element,60+radius*.11,60),{x:0,y:0});assert.equal(reads,2);
 const legacy=createJoystickProjector();assert(Math.abs(legacy.project(element,60+radius*.15,60).x-.15)<1e-12);
});
test('charge feedback is immediate and writes only changed DOM values; critical HUD ignores charge tick spam',()=>{
 let queries=0,writes=0,text='',value=-1,hidden=true;const meter={set value(v){writes++;value=v},setAttribute(){writes++}},label={set textContent(v){writes++;text=v}},root={set hidden(v){writes++;hidden=v},querySelector(selector){queries++;return selector==='progress'?meter:label}};
 const feedback=createChargeFeedback();feedback.paint(root,0,'Skudkraft',true);assert.equal(hidden,false);assert.equal(text,'Skudkraft');const prior=writes;
 for(let i=0;i<120;i++)feedback.paint(root,0,'Skudkraft',true);assert.equal(writes,prior);assert.equal(queries,2);feedback.paint(root,.5,'Skudkraft',true);assert.equal(value,.5);feedback.paint(root,0,'Løftet aflevering',false);assert(hidden);assert.equal(text,'Løftet aflevering');
 const gate=createCriticalHudGate(),s=createArcade('gate56',config);assert(gate(s));for(let i=0;i<18;i++){s.shotCharge=i;assert(!gate(s));}s.controlled=6;assert(gate(s));s.ball.owner={team:'home',index:6};assert(gate(s));s.openingKickoff=null;s.freeze=0;assert(gate(s));s.skillCooldown=20;assert(gate(s));s.skillCooldown=19;assert(!gate(s));s.skillCooldown=0;assert(gate(s));
});
test('one-shot input survives neutral four-input catchup and an isolated tactical command, with exact replay/packet',()=>{
 const match={id:'feel56',started:1000,ends:251000,manual:{version:11,seed:'feel56',config}},session=createManualSession(match,{now:1000}),controls={pass:true,shoot:false,skill:false,through:false},command=commandForTactic('attacking'),reference=new Uint16Array(5000);let largest=0;
 while(session.count<100){const before=session.count;session.advance(6000,command,{maxInputs:4});largest=Math.max(largest,session.count-before);assert(!consumeDirectOneShots(controls,session.inputApplied,command,true));assert(controls.pass);}
 reference[99]=command;session.advance(6050,512,{maxInputs:4});assert(consumeDirectOneShots(controls,session.inputApplied,null,true));assert(!controls.pass);reference[100]=512;
 while(!session.complete){const before=session.count;session.advance(251000,0,{maxInputs:4});largest=Math.max(largest,session.count-before);}assert(largest<=4);
 const rules=getArcadeRules(11,3);assert.equal(session.packet(),rules.encodeInputs(reference));assert.deepEqual(session.state,replayArcade(match.manual.seed,config,reference));
});
test('client input timestamps wait for actual consumption and exclude cancelled background gestures',()=>{
 const tracker=createInputLatencyTracker();tracker.mark('move',10);tracker.mark('move',14);tracker.mark('shoot',20);tracker.applied(35);const first=tracker.report();assert.equal(first.inputSamples,2);assert.equal(first.inputMeanMs,20);assert.equal(first.inputMaxMs,25);
 tracker.mark('passHeld',37);tracker.cancel('passHeld');tracker.mark('skill',40);tracker.reset();tracker.applied(5000);assert.deepEqual(tracker.report(),first);
 const log=createMatchPerformanceLog();log.record({...first,fps:60},'auto');assert.equal(log.report().samples[0].inputMeanMs,20);assert.equal(log.report(first).input.inputMeanMs,20);
});
test('a verified R3 kick removes the old reception hold; unresolved duels and legacy predictions remain guarded',()=>{
 const s=createArcade('release56',config);s.freeze=0;s.tick=101;
 for(const team of ['home','away'])for(const p of s[team])Object.assign(p,{x:25,y:35,vx:0,vy:0});
 Object.assign(s.ball,{x:0,y:0,z:.24,vx:25,vy:0,vz:2,owner:null,lastTouch:{team:'home',index:6},lastTouchTick:101});s.lastContact={tick:100,kind:'touch',team:'home',index:6};s.lastAction={tick:101,kind:'shot',team:'home',index:6};const before=structuredClone(s);
 assert.equal(safeMatchPrediction(s,.04),.04);assert.deepEqual(s,before);s.engineRevision=2;assert.equal(safeMatchPrediction(s,.04),0);s.engineRevision=3;s.lastAction.index=5;assert.equal(safeMatchPrediction(s,.04),0);s.lastAction.index=6;
 Object.assign(s.away[3],{x:.5,y:0});assert.equal(safeMatchPrediction(s,.04),0);s.away[3].x=25;s.lastAction={tick:101,kind:'tackle',team:'away',index:3};assert.equal(safeMatchPrediction(s,.04),0);
});
test('authored kicks use their own 7/10-tick lifetime, interpolate subframes and survive another player action',()=>{
 const s={controlled:0,ball:{owner:null},lastAction:{kind:'pass',team:'away',index:3}},p={kick:7,action:'kick',actionTicks:7,actionDuration:7},out={};const before=structuredClone(p);
 assert.equal(sampleFootballAction(p,s,'home',0,'run',1,out),out);assert.equal(out.clip,'pass');assert(Math.abs(out.time-.45*.55)<1e-12);
 const start=out.time;sampleFootballAction(p,s,'home',0,'run',1,out,.025);assert(out.time>start);p.kick=1;sampleFootballAction(p,s,'home',0,'run',1,out,.045);assert(out.time<.55&&out.time>.5);
 Object.assign(p,before,{kick:10,actionDuration:10,actionTicks:10});sampleFootballAction(p,s,'home',0,'run',1,out);assert.equal(out.clip,'shoot');assert(Math.abs(out.time-.45*.7)<1e-12);
 const charge={...s,shotCharge:18,ball:{owner:{team:'home',index:0}}};sampleFootballAction({...p,kick:0},charge,'home',0,'idle',1,out);assert.equal(out.clip,'shoot');assert.equal(out.time,.45*.7);
 const stopped=sampleFootballAction(p,{...s,replayHold:true},'home',0,'run',1,{},.04);assert.equal(stopped.time,.45*.7);
});
test('locomotion uses hysteresis instead of repeated idle/walk/run swaps at noisy thresholds',()=>{
 const select=createLocomotionSelector();assert.equal(select(.29),'idle');assert.equal(select(.31),'walk');for(const speed of[3.79,3.81,3.75,3.9])assert.equal(select(speed),'walk');assert.equal(select(4.2),'run');for(const speed of[3.8,3.6,3.5])assert.equal(select(speed),'run');assert.equal(select(3.3),'walk');assert.equal(select(.17),'idle');assert.equal(select(0,true),'cheer');assert.equal(select(0),'idle');
});
test('camera catches a moving target with less lag, remains frame-rate independent and resets after kickoff/background',()=>{
 const plan=x=>({eye:[x+22,14,3],target:[x,.8,0],fov:42}),measured=[];
 for(const hz of [30,60,120]){const rig=createLivingCameraRig(),old=createLivingCameraRig({response:9,feedforward:false});rig.update(plan(0),0);old.update(plan(0),0);let p,b;
  for(let i=1;i<=hz;i++){p=rig.update(plan(8*i/hz),1/hz);b=old.update(plan(8*i/hz),1/hz);}const current=8-p.target[0],baseline=8-b.target[0];assert(current<baseline*.2);measured.push({hz,current,baseline});
  let maximum=0;for(let i=0;i<hz;i++){p=rig.update(plan(8),1/hz);maximum=Math.max(maximum,p.target[0]-8);}assert(maximum<.24);assert.deepEqual(rig.update(plan(0),.02,{snap:true}).target,[0,.8,0]);
 }
 assert(Math.max(...measured.map(m=>m.current))-Math.min(...measured.map(m=>m.current))<.01);
 const start=plan(0),step=plan(1),positions=[];for(const hz of [30,60,120]){const rig=createLivingCameraRig();rig.update(start,0);let pose;for(let i=0;i<hz;i++)pose=rig.update(step,1/hz);positions.push(pose.target[0]);}assert(Math.max(...positions)-Math.min(...positions)<1e-8);
 const s=createArcade('cam56',config);assert.deepEqual(livingCameraPlan(s,2).target,[0,.8,0]);s.freeze=0;s.openingKickoff=null;s.ball.vx=25;assert(livingCameraPlan(s,2).target[0]>livingCameraPlan(s,2,{reducedMotion:true}).target[0]);
 writeFileSync('outputs/direct-feel56-camera.json',JSON.stringify({source:'Analytic camera tracking test; not physical device/FPS measurements',measured},null,2));
});
test('all frozen R2/R3 physics and packaged TEST55 binary assets remain byte intact',()=>{
 assert.equal(createHash('sha256').update(readFileSync('shared/football-engine11-r2.js')).digest('hex'),'4ad518a8d5fe454a76cbca4345f0f2294a1b6e7fddb3f98c9d17dad47d6d6f42');assert.equal(createHash('sha256').update(readFileSync('shared/football-engine11-r3.js')).digest('hex'),'274b4d45a4fae126f62e3e9d79f7c76e9bc8eca0aa6d59fcfcc1203961fe1e10');
 const manifest=JSON.parse(readFileSync('public/match-assets55/manifest.json'));for(const f of manifest.files)assert.equal(createHash('sha256').update(readFileSync('public/match-assets55/'+f.file)).digest('hex'),f.sha256);
});
test('actual R3 GLB keeps its soles grounded through acceleration, 180-degree turns, kicks and stepovers at 60/120Hz',async()=>{
 const input=readFileSync('public/match-assets55/player-auto.glb'),n=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+n));
 for(const m of json.materials){delete m.normalTexture;delete m.extensions;delete m.occlusionTexture;delete m.emissiveTexture;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}
 const text=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),bin=input.subarray(20+n),output=Buffer.alloc(20+padded.length+bin.length);input.copy(output,0,0,12);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);bin.copy(output,20+padded.length);
 const previous={self:globalThis.self,document:globalThis.document},ctx=new Proxy({},{get:()=>()=>{},set:()=>true});globalThis.self=globalThis;globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{
  const gltf=await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');gltf.scene.userData.richPack=true;gltf.scene.animations=gltf.animations;
  for(const hz of [60,120]){
   const model=createFootballPlayer({source:gltf.scene,optimize:false}),p={x:0,y:0,vx:0,vy:0,ax:0,ay:0,facingX:0,facingY:1,kick:0,tackle:0,dive:0},state={version:11,engineRevision:3,controlled:0,ball:{owner:null},lastAction:{kind:'pass',team:'away',index:3}};let sole;model.traverse(o=>{if(o.material?.name==='Sneaker outsole')sole=o;});assert(sole);const point=new THREE.Vector3();
   for(let i=0;i<hz*3;i++){
    const t=i/hz,speed=t<.5?t*16:6,heading=t<.5?0:t<1.3?(t-.5)/.8*Math.PI:Math.PI;p.vx=Math.sin(heading)*speed;p.vy=Math.cos(heading)*speed;p.x+=p.vx/hz;p.y+=p.vy/hz;p.facingX=Math.sin(heading);p.facingY=Math.cos(heading);p.action='run';p.kick=0;
    if(t>=1.3&&t<1.65){p.action='kick';p.actionDuration=7;p.kick=p.actionTicks=Math.max(1,7-Math.floor((t-1.3)*20));}
    if(t>=2.25&&t<2.85){p.action='skill';p.actionDuration=12;p.actionTicks=Math.max(1,12-Math.floor((t-2.25)*20));}
    model.position.set(p.x,0,p.y);model.rotation.y=heading;animateFootballPlayer(model,p,state,'home',0,1/hz,true,i===0,(t*20-Math.floor(t*20))*.05);model.updateMatrixWorld(true);
    if(i%6===0){let floor=Infinity;for(let k=0;k<sole.geometry.attributes.position.count;k++){sole.getVertexPosition(k,point).applyMatrix4(sole.matrixWorld);floor=Math.min(floor,point.y);}assert(floor>.01&&floor<.055,`${hz}Hz ${p.action} t=${t}: actual floor=${floor}`);}
    for(const bone of Object.values(model.userData.bones))assert(Math.abs(bone.quaternion.length()-1)<1e-6);
   }
  }
 }finally{Object.assign(globalThis,previous);}
});
test('signed torso turning agrees at 30/60/120Hz and a stepover adds to the current running pose',()=>{
 const result=[];
 for(const sign of [-1,1])for(const hz of [30,60,120]){
  const bone=new THREE.Bone();bone.name='Spine2';const identity=new THREE.Quaternion(),peak=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.32),track=(name,values)=>new THREE.AnimationClip(name,1,[new THREE.QuaternionKeyframeTrack('Spine2.quaternion',[0,.5,1],values)]),clips=[track('run',[...identity.toArray(),...identity.toArray(),...identity.toArray()]),track('turn',[...identity.toArray(),...peak.toArray(),...identity.toArray()])];
  const animation=createAssetPlayerAnimation(clips,{Spine2:bone}),p={vx:0,vy:6,facingX:0,facingY:1,kick:0,dive:0,tackle:0},s={ball:{owner:null}};animation.apply('run',0,p,s,'home',0,0,0,true);
  for(let i=1;i<=hz;i++)animation.apply('run',i/hz,p,s,'home',0,1/hz,sign*.75*i/hz);
  result.push({sign,hz,q:bone.quaternion.clone()});assert(Math.sign(bone.quaternion.y)===sign);
 }
 for(const sign of [-1,1]){const entries=result.filter(r=>r.sign===sign);for(const entry of entries)assert(entry.q.angleTo(entries[0].q)<1e-7);}
 const leg=new THREE.Bone(),rest=new THREE.Quaternion(),running=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.4),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.2),swing=createFootballSwing({RightUpLeg:leg},new Map([['RightUpLeg',rest]]),new Map([['RightUpLeg',rest]]));
 leg.quaternion.copy(running);swing('RightUpLeg',.2,0,0,true);assert(leg.quaternion.angleTo(rotation.clone().multiply(running))<1e-7);swing('RightUpLeg',.2);assert(leg.quaternion.angleTo(rotation)<1e-7);
});
test('canonical match phases follow real kickoff, goal, halftime and restart state without advancing or locking it',()=>{
 const rules=getArcadeRules(11,3),s=createArcade('flow56',config);assert.equal(matchPhase(s),MATCH_PHASE.KICK_OFF);
 for(let i=0;i<25;i++)rules.stepArcade(s,0);
 assert.equal(matchPhase(s),MATCH_PHASE.PLAYING);
 const saved=structuredClone(s);for(let i=0;i<100;i++)matchPhase(s);assert.deepEqual(s,saved);
 for(const [kind,phase]of [['throw-in','THROW_IN'],['corner','CORNER'],['goal-kick','GOAL_KICK']]){s.openingKickoff=null;s.restart={kind};s.freeze=10;assert.equal(matchPhase(s),phase);s.freeze=0;assert.equal(matchPhase(s),'PLAYING');}
 s.goalSequence={stage:'net'};assert.equal(matchPhase(s),'GOAL_SCORED');s.goalSequence.stage='celebration';assert.equal(matchPhase(s),'GOAL_SCORED');s.goalSequence.stage='kickoff';s.freeze=24;assert.equal(matchPhase(s),'KICK_OFF');
 s.period='halftime';assert.equal(matchPhase(s),'HALFTIME');s.period='finished';assert.equal(matchPhase(s),'FULL_TIME');
});
test('goal whistle follows a genuinely new score, stays silent on restore and yields to halftime/full-time signals',()=>{
 const cues=[],sound={goal(){cues.push('net')},crowd(){cues.push('crowd')},whistle(kind){cues.push(kind)}},observe=createGoalAudioObserver();
 assert(!observe(sound,3,'waiting',true));assert(!observe(sound,3,'first',true));assert.deepEqual(cues,[]);assert(observe(sound,4,'first',true));assert.deepEqual(cues,['net','crowd','goal']);assert(!observe(sound,4,'first',true));assert(!observe(sound,4,'second',true));
 cues.length=0;assert(observe(sound,5,'halftime',true));assert.deepEqual(cues,['net','crowd']);cues.length=0;assert(observe(sound,6,'finished',true));assert.deepEqual(cues,['net','crowd']);
 const legacy=createGoalAudioObserver();legacy(sound,0,'first');cues.length=0;legacy(sound,1,'first');assert.deepEqual(cues,['net','crowd']);
});
