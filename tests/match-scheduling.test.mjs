import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchTickPhase,createDetailWarmQueue,createIdleMatchSave} from '../src/match-scheduling.js';

function scheduler(){let id=0;const work=new Map(),cancelled=[];return{work,cancelled,schedule:(callback,options)=>{const key=++id;work.set(key,{callback,options});return key;},cancel:key=>{cancelled.push(key);work.delete(key);},run(budget=12){const entry=work.entries().next().value;if(!entry)return;work.delete(entry[0]);entry[1].callback({timeRemaining:()=>budget,didTimeout:false});}};}

test('fixed-step phase keeps constant-speed targets even across 20Hz physics and 30Hz drawing',()=>{
 const speed=8,targets=[];
 for(let i=0;i<=9;i++){const elapsedMs=i*1000/30,tick=Math.floor((elapsedMs+1e-8)/50),position=tick*.05*speed,phase=matchTickPhase({elapsedMs,tick});targets.push(position+speed*phase);assert(Math.abs(targets.at(-1)-elapsedMs/1000*speed)<1e-8);}
 for(let i=1;i<targets.length;i++)assert(Math.abs(targets[i]-targets[i-1]-speed/30)<1e-8);
 assert.equal(matchTickPhase({elapsedMs:66,tick:1}),.016);
 assert.equal(matchTickPhase({elapsedMs:500,tick:1}),.045,'long gaps cannot over-predict');
 assert.equal(matchTickPhase({elapsedMs:45,tick:1}),0,'server-clock corrections cannot predict backwards');
 assert.equal(matchTickPhase({elapsedMs:66,tick:1,freeze:1}),0);
 assert.equal(matchTickPhase({elapsedMs:66,tick:1,snap:true}),0);
 assert.equal(matchTickPhase({elapsedMs:NaN,tick:1}),0);
 assert.equal(matchTickPhase({elapsedMs:undefined,tick:1,fallbackMs:20}),.02);
 assert.equal(matchTickPhase({elapsedMs:undefined,tick:1,fallbackMs:200}),.045);
});

test('detail warming creates nothing during request and respects idle budget, deduplication and one rig per callback',()=>{
 const idle=scheduler(),created=[],a={wanted:true},b={wanted:true},queue=createDetailWarmQueue({...idle,create:record=>{created.push(record);record.high={ready:true};}});
 assert(queue.request(a));assert(queue.request(a));assert(queue.request(b));assert.equal(created.length,0);assert(a.pending&&b.pending);assert.equal(idle.work.size,1);assert.equal([...idle.work.values()][0].options,undefined,'optional details have no forced timeout');
 idle.run(7);assert.equal(created.length,0);assert.equal(idle.work.size,1);
 idle.run(8);assert.deepEqual(created,[a]);assert.equal(a.pending,false);assert(b.pending);assert.equal(idle.work.size,1);
 idle.run(12);assert.deepEqual(created,[a,b]);assert.equal(b.pending,false);assert.equal(idle.work.size,0);assert.equal(queue.request(a),false);queue.dispose();
});

test('unwanted detail work is skipped and disposed callbacks cannot create late rigs',()=>{
 const idle=scheduler(),a={wanted:true},b={wanted:true};let created=0;
 const queue=createDetailWarmQueue({...idle,create:()=>created++});queue.request(a);queue.request(b);a.wanted=false;idle.run(12);assert.equal(created,1);assert(!a.pending&&!b.pending);
 const c={wanted:true};queue.request(c);const late=[...idle.work.values()][0].callback;queue.dispose();assert(!c.pending);late({timeRemaining:()=>50});assert.equal(created,1);assert.equal(queue.request({wanted:true}),false);
 const unavailable=createDetailWarmQueue({schedule:null,create:()=>created++});assert.equal(unavailable.request({wanted:true}),false);assert.equal(created,1);unavailable.dispose();
});

test('routine saves coalesce with a bounded idle timeout and final flush is synchronous',()=>{
 const idle=scheduler();let saves=0;const queue=createIdleMatchSave({...idle,save:()=>++saves});queue.request();queue.request();assert.equal(saves,0);assert.equal(idle.work.size,1);assert.deepEqual([...idle.work.values()][0].options,{timeout:1500});idle.run(0);assert.equal(saves,1,'idle timeout is allowed to persist even without spare time');queue.request();const late=[...idle.work.values()][0].callback;assert.equal(queue.flush(),2);assert.equal(idle.work.size,0);late();assert.equal(saves,2,'cancelled idle work cannot duplicate the flush');queue.dispose();assert.equal(queue.request(),false);queue.flush();assert.equal(saves,2);
});

test('save scheduling has a timer fallback while disposal cancels pending background work',()=>{
 const timer=scheduler();let saves=0;
 const queue=createIdleMatchSave({schedule:null,setTimer:timer.schedule,clearTimer:timer.cancel,save:()=>saves++});assert(queue.request());assert.equal([...timer.work.values()][0].options,0);assert.equal(saves,0);timer.run();assert.equal(saves,1);queue.request();const late=[...timer.work.values()][0].callback;queue.dispose();late();assert.equal(saves,1);assert.equal(timer.work.size,0);
});
