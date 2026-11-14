import{test}from'node:test';import assert from'node:assert/strict';
import{createGameRequests,gamePollDelay,handleGameActionFailure}from'../src/game-requests.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}};

test('overlapping refresh triggers share one request and a completed refresh can run again',async()=>{
 const requests=createGameRequests(),pending=deferred();let calls=0;
 const first=requests.runRead(async current=>{calls++;assert(current());return pending.promise});
 const second=requests.runRead(()=>{throw Error('duplicate fetch')});
 assert.equal(first,second);assert(requests.reading);await Promise.resolve();assert.equal(calls,1);
 pending.resolve('club');assert.equal(await second,'club');assert.equal(requests.reading,false);
 assert.equal(await requests.runRead(()=>{calls++;return'fresh'}),'fresh');assert.equal(calls,2);
});
test('the write lock takes effect synchronously and foreground polls do not add a competing read',async()=>{
 const requests=createGameRequests(),pending=deferred();let writes=0,reads=0;
 const first=requests.runWrite(()=>{writes++;return pending.promise});
 const duplicate=requests.runWrite(()=>{writes++;return'duplicate'});
 const refresh=requests.runRead(()=>{reads++;return'poll'});
 assert(requests.writing);assert.equal(await duplicate,null);assert.equal(await refresh,null);assert.equal(writes,1);assert.equal(reads,0);
 pending.resolve('saved');assert.equal(await first,'saved');assert.equal(requests.writing,false);
 assert.equal(await requests.runRead(()=>{reads++;return'new-state'}),'new-state');assert.equal(reads,1);
});
test('account reset invalidates pending response guards and an old finally cannot unlock a newer write',async()=>{
 const requests=createGameRequests(),old=deferred(),next=deferred();let oldCurrent;
 const first=requests.runWrite(current=>{oldCurrent=current;return old.promise});await Promise.resolve();assert(oldCurrent());
 requests.reset();assert.equal(oldCurrent(),false);const second=requests.runWrite(()=>next.promise);assert(requests.writing);
 old.resolve('old');assert.equal(await first,'old');assert(requests.writing);
 assert.equal(await requests.runWrite(()=>{throw Error('must stay locked')}),null);
 next.resolve('new');assert.equal(await second,'new');assert.equal(requests.writing,false);
});
test('reset prevents queued operations from starting and old read cleanup preserves a new read',async()=>{
 const requests=createGameRequests();let calls=0;const queued=requests.runWrite(()=>{calls++});requests.reset();assert.equal(await queued,null);assert.equal(calls,0);
 const old=deferred(),fresh=deferred();let guard;
 const first=requests.runRead(current=>{guard=current;return old.promise});await Promise.resolve();requests.reset();
 const second=requests.runRead(()=>fresh.promise);old.resolve('old');await first;assert.equal(guard(),false);assert(requests.reading);
 assert.equal(requests.runRead(()=>{throw Error('new read must be shared')}),second);fresh.resolve('fresh');assert.equal(await second,'fresh');assert.equal(requests.reading,false);
});
test('failed requests release only their own locks and propagate errors for the existing error UI',async()=>{
 const requests=createGameRequests();await assert.rejects(requests.runWrite(()=>{throw Error('network')}),/network/);assert.equal(requests.writing,false);
 await assert.rejects(requests.runRead(()=>Promise.reject(Error('offline'))),/offline/);assert.equal(requests.reading,false);
 assert.equal(await requests.runWrite(()=>42),42);
});
test('background polling stops; simulated matches refresh quickly and manual matches use the idle cadence',()=>{
 assert.equal(gamePollDelay(),10000);assert.equal(gamePollDelay({clubMatch:{}}),2000);assert.equal(gamePollDelay({careerTask:{kind:'match'}}),2000);
 assert.equal(gamePollDelay({clubMatch:{manual:{}},careerTask:{kind:'training'}}),10000);
 assert.equal(gamePollDelay({careerTask:{kind:'match',manual:{}}}),10000);
 assert.equal(gamePollDelay({hidden:true,clubMatch:{},careerTask:{kind:'match'}}),null);
});

test('a successful write invalidates a delayed read error and old cleanup cannot erase the following refresh',async()=>{
 const requests=createGameRequests(),old=deferred(),fresh=deferred();let oldCurrent,errors=0;
 const stale=requests.runRead(async current=>{oldCurrent=current;try{return await old.promise;}catch(error){if(current())errors++;return null;}});
 await Promise.resolve();assert(oldCurrent());
 assert.equal(await requests.runWrite(()=>"saved"),"saved");assert.equal(oldCurrent(),false);assert.equal(requests.reading,false);
 const current=requests.runRead(()=>fresh.promise);assert(requests.reading);
 old.reject(Error("expired session from obsolete refresh"));assert.equal(await stale,null);assert.equal(errors,0);assert(requests.reading);
 assert.equal(requests.runRead(()=>{throw Error("must share new refresh")}),current);
 fresh.resolve("updated club");assert.equal(await current,"updated club");assert.equal(requests.reading,false);
});
test('starting a write prevents an older queued refresh from fetching at all',async()=>{
 const requests=createGameRequests();let fetched=false;
 const stale=requests.runRead(()=>{fetched=true;return"old"});
 const write=requests.runWrite(()=>"saved");assert.equal(await stale,null);assert.equal(fetched,false);assert.equal(await write,"saved");
});

test('critical save errors reach the match, ordinary failures notify once and stale-account errors do neither',()=>{const error=Error('Native request failed');let notices=0;const notify=()=>notices++;assert.throws(()=>handleGameActionFailure(error,{current:true,critical:true,notify}),e=>e===error);assert.equal(notices,0);handleGameActionFailure(error,{current:true,notify});assert.equal(notices,1);handleGameActionFailure(error,{current:false,critical:true,notify});assert.equal(notices,1);});
