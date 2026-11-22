import {isAppHidden,watchAppVisibility} from './app-visibility.js';
// Cancel drawing and routine UI work in the background. The authoritative
// clock keeps running; the session catches up with neutral inputs on return.
export function createVisibleMatchLoop({frame,onHide=()=>{},onResume=()=>{},document:doc=globalThis.document,request=globalThis.requestAnimationFrame,cancel=globalThis.cancelAnimationFrame}={}) {
 let disposed=false,handle=null,wasHidden=isAppHidden(doc);
 const arm=()=>{if(!disposed&&!isAppHidden(doc)&&handle===null)handle=request(run);};
 const run=t=>{handle=null;if(disposed||isAppHidden(doc))return;if(frame(t)!==false)arm();};
 const change=()=>{
  const hidden=isAppHidden(doc);if(hidden===wasHidden)return;wasHidden=hidden;
  if(hidden){if(handle!==null)cancel(handle);handle=null;onHide();}
  else{onResume();arm();}
 };
 const stop=watchAppVisibility(change,doc);arm();
 return {dispose(){if(disposed)return;disposed=true;stop();if(handle!==null)cancel(handle);handle=null;}};
}
