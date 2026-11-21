import {matchStatisticText} from '../src/match-statistics.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import {Scene} from 'three';
import {analyseMatch} from '../src/match-analysis.js';import {createGoalSoundTracker,createMatchAudioFeed} from '../src/match-audio-feed.js';import {createBallTrail} from '../src/ball-trail.js';
import {createMatchSound} from '../src/match-sound.js';
test('analysis uses actual goals and assists, excludes own goals and never invents an unrecorded star',()=>{
 const state={stats:{homeShots:1,awayShots:6,homePassAttempts:10,homeCompletedPasses:5,homePossession:30,awayPossession:70},events:[{kind:'goal',side:'home',scorer:3,assister:7},{kind:'goal',side:'home',scorer:5,ownGoal:true}],home:[{energy:20},{energy:90}]};const before=structuredClone(state),roster=Array.from({length:11},(_,i)=>({name:'Navn '+i})),result=analyseMatch(state,roster);
 assert.equal(result.star.name,'Navn 3');assert.equal(result.star.goals,1);assert.equal(result.accuracy,50);assert.equal(result.tired,1);assert.equal(result.advice.length,2);assert.deepEqual(state,before);
 const away=analyseMatch({...state,events:[...state.events,{kind:'goal',side:'away',scorer:2},{kind:'goal',side:'away',scorer:2}]},roster);assert.equal(away.star.side,'away');assert.equal(away.star.name,'Modstanderens spiller 3');
 assert.equal(matchStatisticText(100,true),'100,0 %');assert.equal(matchStatisticText(0,true),'0,0 %');
 assert.equal(analyseMatch({}).star,null);assert.equal(analyseMatch({}).tired,null);assert.equal(analyseMatch({stats:{homePassAttempts:0,homeCompletedPasses:0}}).accuracy,null);
});
test('audio feed ignores stale opening actions, throttles real kicks and resets without a false return sound',()=>{
 const tracker=createGoalSoundTracker();assert(!tracker(0,'waiting'));assert(!tracker(3,'first'));assert(tracker(4,'first'));assert(!tracker(4,'first'));assert(!tracker(0,'waiting'));assert(!tracker(6,'second'));
 const feed=createMatchAudioFeed(),calls=[],sound={impact:(...args)=>{calls.push(args);return true}},state={lastAction:{kind:'pass',tick:1},freeze:0};
 assert.equal(feed.observe(state,sound,0),false);state.lastAction={kind:'shot',tick:2,power:.8};assert.equal(feed.observe(state,sound,80),true);assert.equal(feed.observe(state,sound,160),false);
 state.lastAction={kind:'woodwork',tick:3};assert(feed.observe(state,sound,200));assert.deepEqual(calls.map(c=>c[0]),['kick','woodwork']);feed.reset();assert.equal(feed.observe(state,sound,400),false);state.freeze=3;state.lastAction={kind:'pass',tick:4};assert.equal(feed.observe(state,sound,500),false);
});
test('ball flight trace reuses one bounded buffer, clears at contact/possession and respects reduced motion',()=>{
 const scene=new Scene(),trail=createBallTrail(scene),state={ball:{vx:20,vy:0,owner:null},freeze:0},positions=trail.line.geometry.attributes.position.array;
 for(let i=0;i<120;i++)trail.update({x:i/6,y:0,z:1},state,i/120);
 assert.equal(scene.children.length,1);assert(trail.line.visible);assert(trail.line.geometry.drawRange.count<=16);assert.equal(trail.line.geometry.attributes.position.array,positions);assert(positions.every(Number.isFinite));
 state.lastContact={tick:10};trail.update({x:20,y:0,z:1},state,1.01);assert(!trail.line.visible);
 trail.update({x:21,y:0,z:1},state,1.02,{reducedMotion:true});assert(!trail.line.visible);state.ball.owner={team:'home',index:1};trail.update({x:22,y:0,z:1},state,1.03);assert(!trail.line.visible);trail.dispose();assert.equal(scene.children.length,0);
});
test('new impact sounds remain opt-in, muted in background, throttled and safe when audio APIs fail',()=>{
 let now=0,nodes=0,hidden=false;class Audio{constructor(){this.state='running';this.destination={}}get currentTime(){return now}createGain(){return{connect(){},disconnect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}}}createOscillator(){nodes++;return{connect(){},disconnect(){},frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},start(){},stop(){}}}resume(){}close(){}}
 const sound=createMatchSound({Audio,hidden:()=>hidden});assert(!sound.impact());sound.toggle();assert(sound.impact());assert(!sound.impact());now=.1;assert(sound.impact('woodwork'));hidden=true;now=.2;assert(!sound.impact());assert.equal(nodes,2);sound.dispose();assert(!sound.impact());assert.equal(sound.crowd(),false);
});

test('post-shader preparation catches up neutrally in four-input yielding batches and preserves the complete packet',async()=>{
 const {finishMatchPreparation}=await import('../src/match-preparation.js'),{createManualSession}=await import('../src/manual-session.js');
 const match={id:'prep54',started:1000,ends:251000,manual:{version:11,seed:'prep54',config:{matchVersion:11,engineRevision:3,homeRating:60,awayRating:60}}};
 const session=createManualSession(match,{now:1000}),reference=createManualSession(match,{now:1000});let yields=0,largest=0;
 const advance=session.advance;session.advance=(time,mask,options)=>{assert.equal(mask,0);assert.equal(options.maxInputs,4);const before=session.count;advance(time,mask,options);largest=Math.max(largest,session.count-before);};
 const inputs=await finishMatchPreparation(session,{started:1000,now:()=>7000,yieldTask:async()=>{yields++;}});assert.equal(inputs,120);assert(yields>=29);assert(largest<=4);
 session.advance=advance;session.advance(251000);reference.advance(251000);assert.equal(session.packet(),reference.packet());assert.deepEqual(session.state,reference.state);
 await assert.rejects(finishMatchPreparation(session,{started:1000,now:()=>251000,signal:{aborted:true}}),{name:'AbortError'});
});
