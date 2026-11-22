import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {athleteGeometry,prepareAthleteVolumes} from '../src/athlete-volume.js';
import {createAssetPlayerAnimation} from '../src/asset-player-animation.js';
import {createBallBodyResponse} from '../src/ball-body-response.js';
import {createFocusMarker} from '../src/focus-marker.js';
import {createNativeLifecycle} from '../src/native-lifecycle.js';
import {isAppHidden,setNativeAppActive,watchAppVisibility} from '../src/app-visibility.js';
import {createVisibleMatchLoop} from '../src/match-visibility.js';
import {createPreparedScenePool,preparedSceneKey} from '../src/prepared-match-scene.js';
import {createMatchAudioFeed,createPhaseWhistleObserver} from '../src/match-audio-feed.js';
import {createMatchSound} from '../src/match-sound.js';
import {createMatchSampleBank} from '../src/match-sample-bank.js';
import {snapshotMatchHud} from '../src/match-hud-state.js';
import {createManualSession} from '../src/manual-session.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {createFootballPlayer,animateFootballPlayer} from '../src/pro-player.js';
import {createMatchFramePacer} from '../src/match-frame-pacer.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=()=>new Promise(r=>setImmediate(r));

test('athlete volume grows radial mass around actual bones without lengthening legs, editing UVs/weights or original geometry',()=>{
 const thigh=new THREE.Bone(),calf=new THREE.Bone();thigh.name='LeftUpLeg';calf.name='LeftLeg';calf.position.y=1;thigh.add(calf);thigh.updateMatrixWorld(true);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([.1,.4,0,0,.4,.1,-.1,.4,0],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1],2));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
 const mesh=new THREE.SkinnedMesh(geometry);mesh.name='Thigh';mesh.add(thigh);mesh.bind(new THREE.Skeleton([thigh,calf]));const before=geometry.attributes.position.array.slice(),volume=athleteGeometry(mesh);
 assert.notEqual(volume,geometry);assert.deepEqual(geometry.attributes.position.array,before);assert.deepEqual(volume.attributes.uv.array,geometry.attributes.uv.array);assert.deepEqual(volume.attributes.skinWeight.array,geometry.attributes.skinWeight.array);
 assert(Math.abs(volume.attributes.position.getX(0)-.128)<1e-6);assert.equal(volume.attributes.position.getY(0),geometry.attributes.position.getY(0));assert.equal(athleteGeometry(mesh),volume);assert([...volume.attributes.normal.array].every(Number.isFinite));
});
test('asset volume preparation yields outside the animation loop and reuses identical bind geometry',async()=>{
 const source=new THREE.Group(),mesh=new THREE.SkinnedMesh(new THREE.BoxGeometry());source.add(mesh);let yields=0;await prepareAthleteVolumes(source,{yieldTask:async()=>{yields++;}});assert.equal(yields,1);assert.equal(athleteGeometry(mesh),mesh.geometry);
});
test('moving pass/shot preserves support-leg gait, while charging preserves both leg chains and idle strikes retain authored poses',()=>{
 const bones=Object.fromEntries(['Hips','LeftUpLeg','RightUpLeg','Spine2'].map(name=>{const b=new THREE.Bone();b.name=name;return[name,b];}));
 const q=angle=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle).toArray();
 const clip=(name,angle)=>new THREE.AnimationClip(name,1,Object.keys(bones).map(b=>new THREE.QuaternionKeyframeTrack(b+'.quaternion',[0,1],[...q(angle),...q(angle)])));
 const rig=createAssetPlayerAnimation([clip('run',.6),clip('pass',-.8),clip('shoot',-.9),clip('idle',0)],bones),p={vx:5,vy:0,facingX:1,facingY:0,kick:7,action:'kick',actionDuration:7},state={controlled:0,ball:{owner:{team:'home',index:0}}};
 rig.apply('run',.4,p,state,'home',0,.05,0,true);assert(bones.LeftUpLeg.quaternion.angleTo(new THREE.Quaternion().fromArray(q(.6)))<1e-6);assert(bones.RightUpLeg.quaternion.angleTo(new THREE.Quaternion().fromArray(q(-.8)))<1e-6);
 p.kick=0;state.shotCharge=10;rig.apply('run',.5,p,state,'home',0,.05,0,true);assert(bones.RightUpLeg.quaternion.angleTo(new THREE.Quaternion().fromArray(q(.6)))<1e-6);
 p.vx=0;p.kick=10;p.actionDuration=10;rig.apply('idle',.5,p,state,'home',0,.05,0,true);assert(bones.LeftUpLeg.quaternion.angleTo(new THREE.Quaternion().fromArray(q(-.9)))<1e-6);
});
test('body reception/pressure response is bounded, continuous across refresh rates and cannot change possession or a rival',()=>{
 const p={x:0,y:0,touch:.8},state={ball:{owner:{team:'home',index:0}},away:[{x:1,y:0},{x:0,y:0,keeper:true}]},saved=structuredClone(state),values=[];
 for(const hz of [30,60,120]){const rig=createBallBodyResponse();let v;for(let i=0;i<hz;i++)v=rig.update(p,state,'home',0,1/hz);values.push({...v});assert(v.touch>.79);assert(v.shield>.58&&v.shield<.59);state.ball.owner=null;for(let i=0;i<hz;i++)v=rig.update(p,state,'home',0,1/hz);assert(v.touch<1e-6);state.ball.owner=saved.ball.owner;}
 assert.deepEqual(state,saved);assert(Math.max(...values.map(v=>v.touch))-Math.min(...values.map(v=>v.touch))<1e-10);
});
test('focus label follows the actual animated head in cached world matrices without asking the scene to recompute skeletons',()=>{
 const model=new THREE.Group(),head=new THREE.Bone(),label=new THREE.Group(),marker=new THREE.Group();model.position.set(4,0,8);model.rotation.y=.7;head.position.set(.3,1.9,0);model.add(head,label);model.userData={bones:{Head:head},label};model.updateMatrixWorld(true);
 head.getWorldPosition=()=>{throw Error('redundant skeleton traversal');};const world=new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);assert(createFocusMarker()(model,marker));assert(Math.abs(marker.position.y-world.y-.5)<1e-9);assert(Math.abs(marker.position.x-world.x)<1e-9);
 const actual=label.position.clone().applyMatrix4(model.matrixWorld);assert(Math.abs(actual.y-world.y-.3)<1e-9);
});
test('native and DOM background notifications produce a single effective pause/resume edge',()=>{
 const doc=new EventTarget();doc.hidden=false;setNativeAppActive(true,doc);const states=[],stop=watchAppVisibility(()=>states.push(isAppHidden(doc)),doc);
 setNativeAppActive(false,doc);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));setNativeAppActive(true,doc);doc.dispatchEvent(new Event('visibilitychange'));doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(states,[true,false]);stop();setNativeAppActive(false,doc);assert.equal(states.length,2);setNativeAppActive(true,doc);
});
test('visible match loop cancels drawing on native background, resumes once and cleans up both event sources',()=>{
 const doc=new EventTarget();doc.hidden=false;setNativeAppActive(true,doc);let scheduled=0,cancelled=0,hidden=0,resumed=0;
 const loop=createVisibleMatchLoop({document:doc,request:()=>++scheduled,cancel:()=>cancelled++,frame(){},onHide:()=>hidden++,onResume:()=>resumed++});setNativeAppActive(false,doc);doc.dispatchEvent(new Event('visibilitychange'));assert.equal(cancelled,1);assert.equal(hidden,1);setNativeAppActive(true,doc);doc.dispatchEvent(new Event('visibilitychange'));assert.equal(resumed,1);assert.equal(scheduled,2);loop.dispose();setNativeAppActive(false,doc);assert.equal(hidden,1);setNativeAppActive(true,doc);
});
test('native listener handles resolving after unmount are removed, not leaked',async()=>{
 const a=deferred(),b=deferred();let removed=0;const lifecycle=createNativeLifecycle(async()=>({App:{addListener:name=>name==='backButton'?a.promise:b.promise}}));await flush();lifecycle.dispose();a.resolve({remove:()=>removed++});b.resolve({remove:()=>removed++});await lifecycle.ready;assert.equal(removed,2);lifecycle.dispose();assert.equal(removed,2);
});
test('stale native getState cannot overwrite a newer foreground/background event',async()=>{
 const state=deferred(),handlers={},events=[];const lifecycle=createNativeLifecycle(async()=>({App:{addListener(name,fn){handlers[name]=fn;return{remove(){}}},getState:()=>state.promise}}),{onActive:active=>events.push(active)});await flush();handlers.appStateChange({isActive:false});state.resolve({isActive:true});await lifecycle.ready;assert.deepEqual(events,[false]);lifecycle.dispose();
});
test('one failed native listener or rejected back action does not strand the other registration',async()=>{
 let removed=0,back;const lifecycle=createNativeLifecycle(async()=>({App:{addListener(name,fn){if(name==='appStateChange')throw Error('optional unavailable');back=fn;return{remove:()=>removed++}}}}),{onBack:()=>Promise.reject(Error('exit unavailable'))});await lifecycle.ready;back();await flush();lifecycle.dispose();assert.equal(removed,1);
});
test('prepared renderer transfers single ownership and keeps identical canvas/shader resources',async()=>{
 const pool=createPreparedScenePool(),calls=[],host={remove:()=>calls.push('remove')},scene={rehost:(h,o)=>calls.push([h,o]),dispose:()=>calls.push('dispose')};assert(await pool.prepare('r3',async()=>({host,scene})));const target={};assert.equal(pool.take('r3',target,{quality:'auto'}),scene);assert.equal(pool.ready,false);pool.clear();assert.deepEqual(calls,[[target,{quality:'auto'}],'remove']);assert.equal(pool.take('r3',target),null);
});
test('cancelled or superseded GPU preparation is disposed, and a mismatched quality cannot reuse an old renderer',async()=>{
 const pool=createPreparedScenePool(),work=deferred();let disposed=0,removed=0;const value=()=>({scene:{dispose:()=>disposed++,rehost(){}},host:{remove:()=>removed++}});const pending=pool.prepare('old',()=>work.promise);pool.clear();work.resolve(value());assert.equal(await pending,false);assert.equal(disposed,1);await pool.prepare('new',async()=>value());assert.equal(pool.take('wrong',{}),null);assert.equal(disposed,2);assert.equal(removed,2);
});
test('R3 renderer profile normalizes irrelevant stadium stage but differentiates revision, quality, pattern and colour',()=>{
 assert.equal(preparedSceneKey({stage:1}),preparedSceneKey({stage:4}));for(const change of[{revision:2},{quality:'sharp'},{color:'blue'},{pattern:'striped'}])assert.notEqual(preparedSceneKey(change),preparedSceneKey({}));assert.notEqual(preparedSceneKey({version:4,stage:1}),preparedSceneKey({version:4,stage:2}));
});
test('initial HUD is the actual R3 kickoff/score/player snapshot and never edits authoritative state',()=>{
 const match={id:'hud59',started:1000,ends:251000,manual:{version:11,seed:'hud59',config:{matchVersion:11,engineRevision:3,homeRating:65,awayRating:62}}},session=createManualSession(match,{now:1000}),saved=structuredClone(session.state),hud=snapshotMatchHud(session,{duration:250,kickoff:2});assert.equal(hud.flow,'KICK_OFF');assert.equal(hud.setup,true);assert.equal(hud.home,session.state.homeScore);assert.equal(hud.controlled,session.state.controlled);assert.equal(hud.radar.length,22);assert.equal(hud.energy,session.state.home[session.state.controlled].energy);assert.deepEqual(session.state,saved);
});
test('R3 confirmed ball speed distinguishes hard passes while new receptions are audible independently of old lastAction',()=>{
 const feed=createMatchAudioFeed(),calls=[],sound={impact:(...v)=>(calls.push(['impact',...v]),true),contact:(...v)=>(calls.push(['contact',...v]),true)},s={version:11,engineRevision:3,tick:10,ball:{vx:10,vy:0,vz:0},home:[{touch:.7}],lastAction:{tick:10,kind:'pass'}};assert(!feed.observe(s,sound,0));s.tick=11;s.lastAction.tick=11;assert(feed.observe(s,sound,100));s.tick=12;s.ball.vx=32;s.lastAction.tick=12;assert(feed.observe(s,sound,200));assert(calls[1][2]>calls[0][2]);s.tick=13;s.lastContact={kind:'touch',tick:13,team:'home',index:0};assert(feed.observe(s,sound,300));assert.equal(calls[2][0],'contact');s.tick=20;s.lastAction={kind:'shot',tick:15};assert(!feed.observe(s,sound,400));feed.reset();assert(!feed.observe(s,sound,500));
});
test('restoring halftime/fulltime does not replay whistles, but genuine live transitions still sound',()=>{
 const hear=createPhaseWhistleObserver(),calls=[],sound={whistle:s=>calls.push(s)};assert(!hear(sound,'finished'));assert(!hear(sound,'waiting'));assert(!hear(sound,'halftime'));hear(sound,'kickoff');assert(hear(sound,'second'));assert(hear(sound,'finished'));assert.deepEqual(calls,['kickoff','finished']);
});

class AudioStub{
 constructor(){this.state='running';this.currentTime=0;this.destination={};this.sources=[];this.resumeGate=null;}
 createGain(){return{connect(){},disconnect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}};}
 createOscillator(){const source={connect(){},disconnect(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},start(){},stop(){source.stopped=true}};this.sources.push(source);return source;}
 resume(){return this.resumeGate?.promise;}
 suspend(){this.suspended=true;return Promise.resolve();}
 close(){return Promise.resolve();}
}
test('fallback whistles/goal chords share the eight-voice budget and mute stops even queued future oscillators immediately',async()=>{
 let context;class Audio extends AudioStub{constructor(){super();context=this;}}
 const sound=createMatchSound({Audio,assetRoot:'',hidden:()=>false});sound.toggle();await sound.unlock();for(let i=0;i<10;i++)sound.whistle('finished');assert.equal(sound.voices,8);assert.equal(context.sources.length,8);sound.toggle();assert.equal(sound.voices,0);assert(context.sources.every(s=>s.stopped));sound.dispose();
});
test('late asynchronous AudioContext resume cannot restart sound after the user mutes',async()=>{
 let context;const gate=deferred();class Audio extends AudioStub{constructor(){super();context=this;this.resumeGate=gate;}}
 const sound=createMatchSound({Audio,assetRoot:'',hidden:()=>false});sound.toggle();const first=sound.unlock();assert.equal(sound.unlock(),first);sound.toggle();gate.resolve();await first;assert(context.suspended);assert.equal(sound.enabled,false);assert.equal(sound.voices,0);sound.dispose();
});
test('sample start failure releases its voice and connections; stopAll is synchronous and idempotent',async()=>{
 let fail=true,disconnected=0;const sources=[],context={state:'running',currentTime:0,decodeAudioData:async()=>({}),createGain:()=>({gain:{},connect(){},disconnect(){disconnected++}}),createBufferSource:()=>{const s={connect(){},disconnect(){disconnected++},start(){if(fail)throw Error('closed');},stop(){}};sources.push(s);return s;}};
 const bank=createMatchSampleBank(context,{base:'/local',output:{},allowed:()=>true,fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)})});await bank.load();assert.equal(bank.decoded,8);assert.equal(bank.play('kick-soft'),false);assert.equal(bank.voices,0);assert.equal(disconnected,2);fail=false;assert(bank.play('kick-soft'));bank.stopAll();assert.equal(bank.voices,0);const count=disconnected;sources.at(-1).onended();assert.equal(disconnected,count);bank.dispose();
});

async function loadRig(name){
 const input=readFileSync('public/match-assets55/'+name),n=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+n));
 for(const m of json.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.extensions;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}
 const text=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),bin=input.subarray(20+n),out=Buffer.alloc(20+padded.length+bin.length);input.copy(out,0,0,12);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);bin.copy(out,20+padded.length);
 const gltf=await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');gltf.scene.userData.richPack=true;gltf.scene.animations=gltf.animations;return gltf.scene;
}
test('all four original rich GLBs gain measurable silhouette volume with identical topology and immutable source vertices',async()=>{
 const previous=globalThis.self;globalThis.self=globalThis;const evidence=[];
 try{for(const name of ['player-auto.glb','player-detail.glb','keeper-auto.glb','keeper-detail.glb']){
  const source=await loadRig(name);let changed=0,vertices=0,maxDelta=0;source.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const old=mesh.geometry.attributes.position,before=old.array.slice(),geometry=athleteGeometry(mesh),next=geometry.attributes.position;assert.equal(next.count,old.count);assert.deepEqual(mesh.geometry.attributes.position.array,before);
   for(let i=0;i<old.count;i++){const d=Math.hypot(next.getX(i)-old.getX(i),next.getY(i)-old.getY(i),next.getZ(i)-old.getZ(i));if(d>1e-6)changed++;maxDelta=Math.max(maxDelta,d);}vertices+=old.count;
  });assert(changed>vertices*.4);assert(maxDelta>.015&&maxDelta<.07);evidence.push({name,vertices,changed,maxDeltaMetres:maxDelta,clips:source.animations.map(c=>c.name)});
 }writeFileSync('outputs/cohesion59-anatomy.json',JSON.stringify({note:'Measured derived geometry, not phone frame rate. Original GLBs unchanged.',models:evidence},null,2));}finally{globalThis.self=previous;}
});
test('real R3 tackling pose remains planted under rotated root instead of burying the toe below the grass',async()=>{
 const prior={self:globalThis.self,document:globalThis.document};globalThis.self=globalThis;globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
 try{const source=await loadRig('player-auto.glb'),model=createFootballPlayer({source,optimize:false}),p={x:0,y:0,vx:2,vy:0,facingX:1,facingY:0,kick:0,dive:0,tackle:10,action:'tackle',actionDuration:16,actionTicks:10},state={version:11,engineRevision:3,controlled:0,ball:{owner:null}},point=new THREE.Vector3();let sole;model.traverse(mesh=>{if(mesh.material?.name==='Sneaker outsole')sole=mesh;});assert(sole);
  for(const hz of [60,120])for(let i=0;i<30;i++){p.tackle=Math.max(1,16-i/2);p.actionTicks=p.tackle;model.position.set(i/hz*2,0,0);model.rotation.y=.7;animateFootballPlayer(model,p,state,'home',0,1/hz,true,i===0);model.updateMatrixWorld(true);let floor=Infinity;for(let j=0;j<sole.geometry.attributes.position.count;j++){sole.getVertexPosition(j,point).applyMatrix4(sole.matrixWorld);floor=Math.min(floor,point.y);}assert(floor>.01&&floor<.055,'actual tackle sole '+floor);}
 }finally{Object.assign(globalThis,prior);}
});

test('slow graphics cannot monopolize a large catch-up; bounded input callbacks converge without dropping a physics tick or changing the packet',()=>{
 const match={id:'draw59',started:1000,ends:251000,manual:{version:11,seed:'draw59',config:{matchVersion:11,engineRevision:3,homeRating:65,awayRating:62}}},results=[];
 for(const gate of [false,true]){
  const session=createManualSession(match,{now:1000}),pace=createMatchFramePacer(60);let now=11000,recovered=null,draws=0,callbacks=0,largest=0;
  while(now<21000){const count=session.count;session.advance(now,0,{maxInputs:4});largest=Math.max(largest,session.count-count);const behind=session.pendingInputs*session.inputMs>=1000;if(!behind&&recovered===null)recovered=now-11000;const draw=pace(now,false,!gate||!behind);callbacks++;if(draw)draws++;now+=draw?250:1000/60;}
  assert(largest<=4);const pending=session.pendingInputs;while(!session.complete)session.advance(match.ends,0,{maxInputs:4});const reference=createManualSession(match,{now:1000});reference.advance(match.ends);assert.equal(session.packet(),reference.packet());assert.deepEqual(session.state,reference.state);results.push({gate,recoveredMs:recovered,pendingInputs:pending,draws,callbacks});
 }
 assert.equal(results[0].recoveredMs,null);assert(results[1].recoveredMs<1500);assert(results[1].pendingInputs<25);assert(results[0].pendingInputs>150);
 writeFileSync('outputs/cohesion59-recovery.json',JSON.stringify({note:'Artificial 250 ms draw cost and 60 Hz callback opportunities; scheduling model, NOT measured Android FPS. Physics and packet compared exactly.',results},null,2));
});
test('drawing restarts immediately after a blocked backlog, including at a backwards/restarted presentation clock',()=>{
 const pace=createMatchFramePacer(60);assert(pace(0));assert(!pace(1));assert(!pace(2,true,false));assert(pace(3));assert(!pace(4));assert(!pace(5,false,false));assert(pace(0));
});
