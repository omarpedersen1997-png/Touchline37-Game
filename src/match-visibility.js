// Cancel drawing and routine UI work in the background. The authoritative
// clock keeps running; the session catches up with neutral inputs on return.
export function createVisibleMatchLoop({frame,onHide=()=>{},onResume=()=>{},document:doc=globalThis.document,request=globalThis.requestAnimationFrame,cancel=globalThis.cancelAnimationFrame}={}) {
 let disposed=false,handle=null;
 const arm=()=>{if(!disposed&&!doc.hidden&&handle===null)handle=request(run);};
 const run=t=>{handle=null;if(disposed||doc.hidden)return;if(frame(t)!==false)arm();};
 const change=()=>{
  if(doc.hidden){if(handle!==null)cancel(handle);handle=null;onHide();}
  else{onResume();arm();}
 };
 doc.addEventListener('visibilitychange',change);arm();
 return {dispose(){if(disposed)return;disposed=true;doc.removeEventListener('visibilitychange',change);if(handle!==null)cancel(handle);handle=null;}};
}
