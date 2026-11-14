// 4K targets a real 3840-pixel long edge while preserving the viewport's aspect.
// This changes rendering resolution, never the phone's physical display resolution.
export function matchResolution({width,height,dpr=1,quality='auto',maxSize=8192,maxViewport=[8192,8192],scale=1}){
 const positive=(n,fallback)=>Number.isFinite(n)&&n>0?n:fallback;
 width=positive(width,1);height=positive(height,1);dpr=positive(dpr,1);scale=positive(scale,1);
 const limitX=Math.min(positive(maxSize,8192),positive(maxViewport?.[0],8192)),limitY=Math.min(positive(maxSize,8192),positive(maxViewport?.[1],8192));
 const longEdge=Math.max(width,height);
 // Sharp matches native pixel density, with supersampling on low-DPR views.
 // Its fixed floor is independent of the automatic performance controller.
 const desired=quality==='4k'?3840/longEdge:quality==='sharp'?Math.min(3840/longEdge,Math.max(dpr,1920/longEdge)):Math.max(1,Math.min(dpr,1.5)*Math.max(.75,Math.min(1,scale)));
 const ratio=Math.min(desired,limitX/width,limitY/height);
 const w=Math.max(1,Math.min(Math.floor(limitX),Math.round(width*ratio))),h=Math.max(1,Math.min(Math.floor(limitY),Math.round(height*ratio)));
 return{width:w,height:h,quality,is4k:quality==='4k'&&Math.max(w,h)>=3839,limited:quality==='4k'&&Math.max(w,h)<3839};
}
export function matchResolutionLabel(plan){return`${plan.is4k?'4K':plan.limited?'Enhedens maksimum':plan.quality==='sharp'?'Skarp 3D':'Auto'} · ${plan.width} × ${plan.height}`;}

export function isSlowMatchFrame(seconds){return Number.isFinite(seconds)&&seconds>1/30*1.35;}

// Auto may trade resolution for time, then recover after a sustained clear run.
// Sharp/4K never enter this controller and retain their exact output size.
export function createAutoResolutionController(){
 let scale=1,pressure=0,healthy=0,lastChange=0;
 return{get scale(){return scale;},sample(seconds,now){
  if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(now))return false;
  if(isSlowMatchFrame(seconds)){pressure=Math.min(60,pressure+1);healthy=Math.max(0,healthy-6);}else{pressure=Math.max(0,pressure-1);healthy=seconds<=.038?healthy+1:Math.max(0,healthy-2);}
  if(now-lastChange<4000)return false;
  let next=scale;
  if(pressure>45)next=Math.max(.75,scale*.85);
  else if(healthy>=240)next=Math.min(1,scale+.1);
  if(next===scale)return false;
  scale=next;pressure=0;healthy=0;lastChange=now;return true;
 }};
}
