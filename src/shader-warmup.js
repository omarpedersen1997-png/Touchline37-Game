// Optional loading work, never a fallback to synchronous shader compilation.
// Three.js cannot cancel an already submitted GPU compile. This controller owns
// only the bounded waiter: late completions never touch a renderer or resources.
export function createShaderWarmup({renderer,scene,camera,timeoutMs=1500,setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}){
 const delay=Number.isFinite(timeoutMs)?Math.max(0,Math.min(1500,timeoutMs)):1500;
 let disposed=false,promise=null,resolveWait=null,timer=null,finished=false;
 const clear=()=>{if(timer!==null){const handle=timer;timer=null;try{clearTimer(handle);}catch{}}};
 const finish=status=>{
  if(finished)return;finished=true;clear();
  const resolve=resolveWait;resolveWait=null;resolve?.(Object.freeze({status}));
 };
 return{
  prepare(){
   if(disposed)return Promise.resolve(Object.freeze({status:'disposed'}));
   if(promise)return promise;
   promise=new Promise(resolve=>{resolveWait=resolve;});
   try{
    if(typeof setTimer!=='function'||typeof clearTimer!=='function'
      ||typeof renderer?.compileAsync!=='function'
      ||renderer.extensions?.has?.('KHR_parallel_shader_compile')!==true){finish('skipped');return promise;}
    timer=setTimer(()=>finish('timeout'),delay);
    // A custom scheduler may fire immediately. It must not start late work.
    if(finished){clear();return promise;}
    const compilation=renderer.compileAsync(scene,camera);
    // Install both handlers immediately, including for an already rejected
    // promise. A timeout/dispose merely makes these callbacks harmless no-ops.
    Promise.resolve(compilation).then(()=>finish(disposed?'disposed':'ready'),()=>finish(disposed?'disposed':'skipped'));
   }catch{finish(disposed?'disposed':'skipped');}
   return promise;
  },
  dispose(){
   if(disposed)return;disposed=true;
   if(promise&&!finished)finish('disposed');else clear();
  },
 };
}
