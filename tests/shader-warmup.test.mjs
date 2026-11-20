import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createShaderWarmup} from '../src/shader-warmup.js';

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function scheduler(){
 let next=0;const pending=new Map();
 return{pending,setTimer(callback,ms){const id=next++;pending.set(id,{callback,ms});return id;},clearTimer(id){pending.delete(id);},fire(){const [id,{callback}]=pending.entries().next().value;pending.delete(id);callback();}};
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('supported parallel compilation is cached and readiness clears the loading deadline',async()=>{
 const work=deferred(),timers=scheduler(),scene={},camera={};let calls=0;
 const renderer={extensions:{has:name=>name==='KHR_parallel_shader_compile'},compile(){throw Error('Never call synchronous fallback');},compileAsync(s,c){assert.equal(s,scene);assert.equal(c,camera);calls++;return work.promise;}};
 const warm=createShaderWarmup({renderer,scene,camera,...timers});
 const first=warm.prepare();assert.equal(warm.prepare(),first);assert.equal(calls,1);assert.equal(timers.pending.size,1);
 work.resolve();assert.deepEqual(await first,{status:'ready'});assert.equal(timers.pending.size,0);assert.equal(warm.prepare(),first);warm.dispose();
 assert.deepEqual(await warm.prepare(),{status:'disposed'});assert.equal(calls,1);
});

test('unsupported or failed capability checks do not invoke any shader compile',async()=>{
 for(const extensions of [undefined,{has:()=>false},{has:()=>null},{has:()=>{throw Error('Context unavailable');}}]){
  let calls=0;const timers=scheduler();
  const renderer={extensions,compile(){calls++;},compileAsync(){calls++;return Promise.resolve();}};
  const warm=createShaderWarmup({renderer,...timers});assert.deepEqual(await warm.prepare(),{status:'skipped'});assert.equal(calls,0);assert.equal(timers.pending.size,0);warm.dispose();
 }
 const timers=scheduler(),warm=createShaderWarmup({renderer:{extensions:{has:()=>true}},...timers});
 assert.deepEqual(await warm.prepare(),{status:'skipped'});assert.equal(timers.pending.size,0);
});

test('the waiter times out within 1500ms and late readiness cannot restart it',async()=>{
 const work=deferred(),timers=scheduler();let calls=0;
 const warm=createShaderWarmup({timeoutMs:9000,renderer:{extensions:{has:()=>true},compileAsync(){calls++;return work.promise;}},...timers});
 const result=warm.prepare();assert.equal([...timers.pending.values()][0].ms,1500);timers.fire();assert.deepEqual(await result,{status:'timeout'});assert.equal(timers.pending.size,0);
 work.resolve();await turn();assert.deepEqual(await warm.prepare(),{status:'timeout'});assert.equal(calls,1);assert.equal(timers.pending.size,0);warm.dispose();
});

test('synchronous errors and promise rejections resolve safely without freezing loading',async()=>{
 for(const compileAsync of [()=>{throw Error('Lost context');},()=>Promise.reject(Error('Shader failed'))]){
  const timers=scheduler(),warm=createShaderWarmup({renderer:{extensions:{has:()=>true},compileAsync},...timers});
  assert.deepEqual(await warm.prepare(),{status:'skipped'});assert.equal(timers.pending.size,0);await turn();warm.dispose();
 }
});

test('dispose aborts the wait and both late fulfillment and rejection do no further work',async()=>{
 for(const failure of [false,true]){
  const work=deferred(),timers=scheduler();let resources=0;
  const renderer={extensions:{has(){resources++;return true;}},compileAsync(){resources++;return work.promise;}};
  const warm=createShaderWarmup({renderer,...timers}),result=warm.prepare();assert.equal(resources,2);assert.equal(timers.pending.size,1);
  warm.dispose();assert.deepEqual(await result,{status:'disposed'});assert.equal(timers.pending.size,0);
  if(failure)work.reject(Error('Late compile failure'));else work.resolve();await turn();
  assert.deepEqual(await warm.prepare(),{status:'disposed'});warm.dispose();assert.equal(resources,2);assert.equal(timers.pending.size,0);
 }
});

test('disposing before preparation never probes a renderer and late rejection after timeout is handled',async()=>{
 let probes=0;const renderer={get compileAsync(){probes++;throw Error('Disposed renderer');}};
 const warm=createShaderWarmup({renderer});warm.dispose();assert.deepEqual(await warm.prepare(),{status:'disposed'});assert.equal(probes,0);
 const work=deferred(),timers=scheduler(),timeout=createShaderWarmup({renderer:{extensions:{has:()=>true},compileAsync:()=>work.promise},...timers});
 const result=timeout.prepare();timers.fire();assert.deepEqual(await result,{status:'timeout'});work.reject(Error('Late rejected compilation'));await turn();assert.equal(timers.pending.size,0);timeout.dispose();
});
