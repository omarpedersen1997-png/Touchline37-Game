// Keep a cadence across slightly uneven animation frames. Resetting the clock
// to each draw time accumulates delay and can turn a 30Hz target into 20Hz.
// Physics/input retain their own fixed deterministic timestep.
export function createMatchFramePacer(hz=30) {
 const interval=1000/hz;
 let next=null,previous=null;
 return (now,force=false)=>{
  if(!Number.isFinite(now))return false;
  if(next===null||force||now<previous){previous=now;next=now+interval;return true;}
  previous=now;
  if(now+.5<next)return false;
  next+=Math.max(1,Math.floor((now-next)/interval)+1)*interval;
  return true;
 };
}
