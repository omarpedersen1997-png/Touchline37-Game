import{test}from'node:test';import assert from'node:assert/strict';
import{createManualSession,createManualSessionAsync}from'../src/manual-session.js';
const make=()=>{const m=new Map();return{get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const match={id:'async-restore',started:1000,ends:251000,manual:{version:11,seed:'restore-test',config:{matchVersion:11,engineRevision:2,homeRating:52,awayRating:57},expiresAt:86400000}};
test('async recovery yields to UI but is identical to complete synchronous recovery',async()=>{
 const storage=make(),original=createManualSession(match,{storage,now:1000});for(let i=1;i<=500;i++)original.advance(1000+i*50,i%5?65:0);original.save();
 const expected=createManualSession(match,{storage,now:251000});let yields=0;
 const actual=await createManualSessionAsync(match,{storage,now:251000,yieldWork:async()=>{yields++}});
 assert(yields>50);assert.deepEqual(actual.state,expected.state);assert.equal(actual.packet(),expected.packet());assert.equal(actual.count,5000);
});
test('cancelling restoration preserves the saved recording and does not finish',async()=>{
 const storage=make(),s=createManualSession(match,{storage,now:1000});s.advance(1100,65);s.save();const key=storage.key(0),before=storage.getItem(key),controller=new AbortController();
 await assert.rejects(createManualSessionAsync(match,{storage,now:251000,signal:controller.signal,yieldWork:async()=>controller.abort()}),e=>e.name==='AbortError');assert.equal(storage.getItem(key),before);
});
test('old engine recovery is still identical and can finish and clear normally',async()=>{
 const legacy={...match,ends:61000,manual:{seed:'old',config:{homeRating:50,awayRating:50},expiresAt:241000}};
 const expected=createManualSession(legacy,{now:61000});const storage=make();const restored=await createManualSessionAsync(legacy,{storage,now:61000});assert.deepEqual(restored.state,expected.state);assert.equal(restored.packet(),expected.packet());restored.clear();restored.save();assert.equal(storage.length,0);
});

test('opening a match does not evict other unexpired recordings',()=>{
 const storage=make();for(let i=0;i<12;i++)storage.setItem('touchline:manual:v1:pending-'+i,JSON.stringify({expiresAt:86400000,seed:'pending-'+i,inputs:[0]}));
 storage.setItem('touchline:manual:v1:expired',JSON.stringify({expiresAt:1}));createManualSession(match,{storage,now:1000});
 for(let i=0;i<12;i++)assert(storage.getItem('touchline:manual:v1:pending-'+i));assert.equal(storage.getItem('touchline:manual:v1:expired'),null);
});

test('recovery reports monotonic progress with a bounded number of updates',async()=>{
 const updates=[];await createManualSessionAsync(match,{now:251000,yieldWork:async()=>{},onProgress:p=>updates.push(p)});
 assert.equal(updates[0],0);assert.equal(updates.at(-1),100);assert(updates.length<=11);assert(updates.every((x,i)=>i===0||x>updates[i-1]));
});
