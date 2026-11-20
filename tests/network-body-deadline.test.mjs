import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestWithRetry,NetworkError} from '../src/network.js';
const timeouts={GET:25,POST:25};
for(const type of ['application/json','text/html'])test(`deadline includes an unfinished ${type} response body`,async()=>{
 let aborted=false,cancel;
 const promise=requestWithRetry(async signal=>{
  signal.addEventListener('abort',()=>{aborted=true;cancel?.();});
  return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));cancel=()=>c.error(new Error('closed'));}}),{headers:{'Content-Type':type}});
 },{path:'/api/auth/login',method:'POST',timeouts});
 await assert.rejects(promise,NetworkError);assert.equal(aborted,true);
});
test('a truncated game response retries and returns a completely readable JSON body',async()=>{
 let calls=0;
 const r=await requestWithRetry(async()=>{
  if(++calls===1)return new Response(new ReadableStream({start(c){c.error(new TypeError('connection lost'));}}));
  return Response.json({state:{version:2}});
 },{path:'/api/game',timeouts,sleep:async()=>{}});
 assert.equal(calls,2);assert.deepEqual(await r.json(),{state:{version:2}});
});
test('normalization of a successful HTML gateway response is retried for game reads',async()=>{
 let calls=0;
 const r=await requestWithRetry(async()=>++calls===1?new Response('<html>gateway</html>'):Response.json({ok:true}),{path:'/api/game',sleep:async()=>{}});
 assert.equal(calls,2);assert.deepEqual(await r.json(),{ok:true});
});
test('caller abort remains effective after headers and auth is never retried',async()=>{
 const controller=new AbortController();let calls=0;
 const promise=requestWithRetry(async signal=>{calls++;return new Response(new ReadableStream({start(c){signal.addEventListener('abort',()=>c.error(signal.reason));}}),{headers:{'Content-Type':'application/json'}});},{path:'/api/auth/login',method:'POST',signal:controller.signal,timeouts:{POST:1000}});
 await new Promise(resolve=>setTimeout(resolve,5));controller.abort();await assert.rejects(promise,e=>e.name==='AbortError');assert.equal(calls,1);
});
test('bodyless responses and status headers remain valid',async()=>{
 for(const status of [204,205,304]){const r=await requestWithRetry(async()=>new Response(null,{status,headers:{'X-Test':'retained'}}),{path:'/api/auth/me'});assert.equal(r.status,status);assert.equal(r.headers.get('X-Test'),'retained');assert.equal(await r.text(),'');}
});
