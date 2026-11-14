// Phase comes from the match clock, never from the draw that first noticed
// a physics tick. This keeps 20Hz physics moving evenly through 30Hz draws.
export function matchTickPhase({elapsedMs,tick,stepMs=50,maxMs=45,snap=false,freeze=0,fallbackMs}){
 if(snap||freeze>0||![stepMs,maxMs].every(Number.isFinite)||stepMs<=0||maxMs<=0)return 0;
 const phase=Number.isFinite(elapsedMs)&&Number.isFinite(tick)?elapsedMs-tick*stepMs:fallbackMs;
 return Number.isFinite(phase)?Math.max(0,Math.min(maxMs,phase))/1000:0;
}

const idleSchedule=()=>typeof globalThis.requestIdleCallback==='function'?globalThis.requestIdleCallback.bind(globalThis):undefined;
const idleCancel=()=>typeof globalThis.cancelIdleCallback==='function'?globalThis.cancelIdleCallback.bind(globalThis):undefined;

// New detailed rigs are optional presentation work. Never construct one in a
// draw or force its creation through a timeout when the device has no spare time.
export function createDetailWarmQueue({schedule=idleSchedule(),cancel=idleCancel(),create}={}){
 if(typeof create!=='function')throw new TypeError('A detail factory is required.');
 let disposed=false,handle=null,generation=0;
 const queue=[],pending=new Set();
 const clear=record=>{pending.delete(record);record.pending=false;};
 const arm=()=>{
  if(disposed||handle!==null||!queue.length||typeof schedule!=='function')return;
  const ownGeneration=generation;
  handle=schedule(deadline=>{
   if(disposed||ownGeneration!==generation)return;
   handle=null;
   while(queue.length&&(queue[0].wanted===false||queue[0].high)){clear(queue.shift());}
   if(!queue.length)return;
   if(typeof deadline?.timeRemaining!=='function'||deadline.timeRemaining()<8){arm();return;}
   const record=queue.shift();clear(record);
   try{create(record);}catch{record.failed=true;}finally{arm();}
  });
 };
 return{
  request(record){
   if(disposed||typeof schedule!=='function'||!record||typeof record!=='object'||record.high||record.failed)return false;
   if(pending.has(record))return true;
   record.pending=true;pending.add(record);queue.push(record);arm();return true;
  },
  dispose(){
   if(disposed)return;disposed=true;generation++;
   if(handle!==null&&typeof cancel==='function')cancel(handle);
   handle=null;for(const record of queue)clear(record);queue.length=0;
  }
 };
}

// Routine persistence can wait for idle time; completion/background/unmount
// still use flush() so durability never depends on an idle callback arriving.
export function createIdleMatchSave({save,schedule=idleSchedule(),cancel=idleCancel(),setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}){
 if(typeof save!=='function')throw new TypeError('A save callback is required.');
 let disposed=false,queued=false,handle=null,kind=null,generation=0;
 const cancelPending=()=>{
  generation++;
  if(queued&&handle!==null){if(kind==='idle'&&typeof cancel==='function')cancel(handle);else if(kind==='timer'&&typeof clearTimer==='function')clearTimer(handle);}
  queued=false;handle=null;kind=null;
 };
 return{
  request(){
   if(disposed)return false;if(queued)return true;
   const ownGeneration=generation;
   const run=()=>{if(disposed||ownGeneration!==generation)return;queued=false;handle=null;kind=null;save();};
   queued=true;
   if(typeof schedule==='function'){kind='idle';handle=schedule(run,{timeout:1500});}
   else if(typeof setTimer==='function'){kind='timer';handle=setTimer(run,0);}
   else{queued=false;return false;}
   return true;
  },
  flush(){if(disposed)return;cancelPending();return save();},
  dispose(){if(disposed)return;disposed=true;cancelPending();}
 };
}
