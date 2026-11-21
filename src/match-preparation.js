// Shader/model preparation consumes wall time. Catch that time before showing
// interactive controls, yielding between tiny neutral batches. No physics drops.
export async function finishMatchPreparation(session,{started,now,signal,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 if(!Number.isFinite(started)||!Number.isFinite(session.inputMs)||session.inputMs<=0)throw new TypeError('Ugyldigt kampur.');
 const initial=session.count;
 for(;;){
  if(signal?.aborted)throw Object.assign(new Error('Kampforberedelsen blev afbrudt.'),{name:'AbortError'});
  const time=now();if(!Number.isFinite(time))throw new TypeError('Ugyldigt kampur.');
  const target=Math.min(session.duration/session.inputMs,Math.max(0,Math.floor((time-started)/session.inputMs)));
  if(session.count>=target)break;
  session.advance(time,0,{maxInputs:4,maxWorkMs:2});
  if(session.count<target)await yieldTask();
 }
 if(session.count!==initial)session.save();
 return session.count-initial;
}
