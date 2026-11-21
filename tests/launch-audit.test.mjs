import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchResolution,createAutoResolutionController} from '../src/match-quality.js';
import {createMatchFrameStats} from '../src/match-frame-stats.js';
import {createVisibleMatchLoop} from '../src/match-visibility.js';
import {createMatchFramePacer} from '../src/match-frame-pacer.js';
import {clubCode} from '../src/match-labels.js';
import {createManualSession} from '../src/manual-session.js';
import {createReplayPlayback} from '../src/replay-playback.js';
import {createMatchSound} from '../src/match-sound.js';
const match={id:'backup-audit',started:1000,ends:251000,manual:{version:11,seed:'backup50',config:{matchVersion:11,engineRevision:2,homeRating:50,awayRating:55},expiresAt:90000000}};
const memory=()=>{const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('motor11 Auto bounds high-DPR and desktop pixel work and genuinely reduces under load; legacy/explicit profiles are retained',()=>{
 for(const size of [{width:1008,height:450,dpr:2.75},{width:3840,height:2160,dpr:2},{width:1920,height:1080,dpr:1}]){
  const normal=matchResolution({...size,version:11}),low=matchResolution({...size,version:11,scale:.5});
  assert(normal.width*normal.height<1203000);assert(normal.width<=1920);assert(low.width*low.height<normal.width*normal.height*.26);
  for(const quality of ['sharp','4k'])assert.deepEqual(matchResolution({...size,quality,version:11,scale:.5}),matchResolution({...size,quality,version:10}));
 }
 assert.deepEqual(matchResolution({width:900,height:400,dpr:3,version:10,scale:.5}),matchResolution({width:900,height:400,dpr:3,scale:.5}));
});
test('4FPS foreground load adapts instead of being mistaken for repeated background gaps',()=>{
 const auto=createAutoResolutionController({targetFps:60});for(let i=0;i<30;i++)auto.sample(.32,i*320,{renderMs:8});assert.equal(auto.scale,.5);
 const low=auto.scale;auto.sample(12,25000);assert.equal(auto.scale,low);auto.reset();assert.equal(auto.scale,low);
 for(let i=0;i<800;i++)auto.sample(1/60,26000+i*1000/60,{renderMs:1});assert(auto.scale>low);
});
test('render cadence stays evenly spaced on 60,90,120Hz displays and stats reset after a hidden interval',()=>{
 for(const hz of [60,90,120]){const due=createMatchFramePacer(60);let count=0;for(let i=0;i<hz*3;i++)if(due(i*1000/hz))count++;assert(Math.abs(count-180)<=1);}
 const stats=createMatchFrameStats();stats(0);for(let i=1;i<=60;i++)stats(i*1000/60);stats.reset();assert.equal(stats(12000),null);let result;for(let i=1;i<=61;i++){const next=stats(12000+i*1000/60);if(next)result=next;}assert.equal(result.fps,60);
});
test('visibility cancels draws, persists once, resumes once and disposes without orphan callbacks',()=>{
 const events=new Map(),queue=new Map();let id=0,hide=0,resume=0,frames=0;
 const doc={hidden:false,addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
 const loop=createVisibleMatchLoop({document:doc,request:f=>{queue.set(++id,f);return id},cancel:i=>queue.delete(i),frame:()=>{frames++;return frames<3},onHide:()=>hide++,onResume:()=>resume++});
 assert.equal(queue.size,1);doc.hidden=true;events.get('visibilitychange')();assert.equal(queue.size,0);assert.equal(hide,1);doc.hidden=false;events.get('visibilitychange')();assert.equal(queue.size,1);assert.equal(resume,1);
 for(let i=0;i<3;i++){const [key,fn]=queue.entries().next().value;queue.delete(key);fn(i*16);}assert.equal(queue.size,0);loop.dispose();assert.equal(events.size,0);
});
test('club codes retain Danish letters, avoid ellipses and remain deterministic for long and empty names',()=>{
 assert.equal(clubCode('Prøvelund BK'),'PRBK');assert.equal(clubCode('Havneby IF'),'HAIF');assert.equal(clubCode('Østerbro'),'ØST');assert.equal(clubCode(''),'TL');assert(!clubCode('Meget Langt Klubnavn FC').includes('…'));
});
test('recording schema restores exact inputs, migrates legacy saves and rejects changed revision or corrupted input',()=>{
 const store=memory(),original=createManualSession(match,{storage:store,now:1000});for(let i=1;i<=100;i++)original.advance(1000+i*50,i%3?65:0);original.save();assert.equal(original.persistenceStatus,'saved');const key=store.key(0),raw=store.getItem(key);
 const restored=createManualSession(match,{storage:store,now:6000});assert.deepEqual(restored.state,original.state);assert.equal(restored.recoveryWarning,false);
 const corrupt=JSON.parse(raw);corrupt.inputs[0]=16;store.setItem(key,JSON.stringify(corrupt));const fallback=createManualSession(match,{storage:store,now:1000});assert.equal(fallback.count,0);assert(fallback.recoveryWarning);
 store.setItem(key,raw);const changed=createManualSession({...match,manual:{...match.manual,config:{...match.manual.config,engineRevision:1}}},{storage:store,now:1000});assert.equal(changed.count,0);assert(changed.recoveryWarning);
 const legacy=JSON.parse(raw);delete legacy.saveSchema;delete legacy.checksum;delete legacy.rulesIdentity;store.setItem(key,JSON.stringify(legacy));const migrated=createManualSession(match,{storage:store,now:6000});assert.deepEqual(migrated.state,original.state);assert.equal(JSON.parse(store.getItem(key)).saveSchema,1);
 const backup=migrated.backup();assert.equal(backup.kind,'touchline-match-recording');assert.equal(backup.record.inputs.length,100);assert(!JSON.stringify(backup).includes('password'));
 const blocked=createManualSession(match,{storage:{getItem(){throw Error()},setItem(){throw Error()}},now:1000});assert.equal(blocked.persistenceStatus,'unavailable');assert(blocked.backup());
});
test('replay pause and speeds alter only presentation time and preserve final real frame',()=>{
 const samples=[],play=createReplayPlayback({durationMs:1000},{targetFps:60,sample:(_,t)=>{samples.push(t);return t}});play(0);play(200);play.setPaused(true,200);play(600);play.setSpeed(2,600);play.setPaused(false,600);const next=play(800);assert.equal(next.state,600);assert.equal(play(1000).state,1000);assert.equal(play(1200).state,null);assert(samples.includes(200));
});
test('optional goal audio persists choice and never creates sound while hidden, muted or disposed',()=>{
 const store=memory();let constructed=0,tones=0,closed=0,hidden=false;
 class Audio {constructor(){constructed++;this.state='running';this.currentTime=0;this.destination={}}createGain(){return {connect(){},disconnect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}}}createOscillator(){tones++;return {connect(){},disconnect(){},frequency:{},start(){},stop(){}}}resume(){return Promise.resolve()}suspend(){return Promise.resolve()}close(){closed++;return Promise.resolve()}}
 const sound=createMatchSound({storage:store,Audio,hidden:()=>hidden});assert.equal(sound.enabled,false);assert.equal(sound.goal(),false);assert.equal(constructed,0);assert(sound.toggle());assert.equal(constructed,1);assert(sound.goal());assert.equal(tones,3);hidden=true;assert.equal(sound.goal(),false);hidden=false;sound.toggle();assert.equal(sound.goal(),false);assert.equal(store.getItem('touchline:match-sound:v1'),'off');sound.dispose();assert.equal(closed,1);assert.equal(sound.goal(),false);
});
test('catch-up gains ground even at 4FPS while yielding on its CPU deadline and preserving replay',()=>{
 const bounded=createManualSession(match,{now:1000}),reference=createManualSession(match,{now:1000});
 for(let now=1250;now<=11000;now+=250)bounded.advance(now,0,{maxInputs:16,maxWorkMs:2,workClock:()=>0});
 assert.equal(bounded.pendingInputs,0);assert.equal(bounded.count,200,'the previous four-input cap falls behind at 4 FPS');
 let clock=0;bounded.advance(12000,0,{maxInputs:16,maxWorkMs:2,workClock:()=>clock++});assert.equal(bounded.count,202);assert.equal(bounded.pendingInputs,18);
 bounded.advance(251000,0);reference.advance(251000,0);assert.equal(bounded.packet(),reference.packet());assert.deepEqual(bounded.state,reference.state);
});
test('phone performance export is bounded, immutable and excludes account/session data',async()=>{
 const {createMatchPerformanceLog}=await import('../src/match-performance-log.js');const log=createMatchPerformanceLog(3);const plan={width:1000,height:450,quality:'auto',token:'never export'};log.resolution(plan);for(let i=0;i<8;i++)log.record({fps:50+i,frameMs:18,password:'never export',renderMs:NaN},'auto');const report=log.report();assert.equal(report.samples.length,3);assert.equal(report.samples[0].fps,55);assert(!JSON.stringify(report).includes('never export'));report.samples[0].fps=1;assert.equal(log.report().samples[0].fps,55);plan.width=1;assert.equal(log.report().resolution.width,1000);
});
test('Android exports use the native user file picker; browser exports release their URL and oversized files fail early',async()=>{
 const {downloadJson}=await import('../src/download-json.js');let request;assert.deepEqual(await downloadJson({kind:'test'},'../log 50',{native:true,exporter:{saveJson:async value=>{request=value;return {saved:true}}}}),{saved:true});assert.equal(request.filename,'log50.json');assert.equal(request.content,'{"kind":"test"}');
 let revoked=false,clicked=false;await downloadJson({kind:'test'},'log',{native:false,doc:{createElement:()=>({click(){clicked=true}})},urls:{createObjectURL:()=> 'blob:local',revokeObjectURL:url=>{assert.equal(url,'blob:local');revoked=true}},timer:fn=>fn()});assert(clicked);assert(revoked);
 await assert.rejects(downloadJson('x'.repeat(1048577),'big',{native:true,exporter:{saveJson(){throw Error('must not run')}}}),/for stor/);
});
