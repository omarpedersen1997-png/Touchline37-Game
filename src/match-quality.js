// 4K targets a real 3840-pixel long edge while preserving the viewport's aspect.
// This changes rendering resolution, never the phone's physical display resolution.
export function matchResolution({width,height,dpr=1,quality='auto',maxSize=8192,maxViewport=[8192,8192],scale=1}){
 const positive=(n,fallback)=>Number.isFinite(n)&&n>0?n:fallback;
 width=positive(width,1);height=positive(height,1);dpr=positive(dpr,1);scale=positive(scale,1);
 const limitX=Math.min(positive(maxSize,8192),positive(maxViewport?.[0],8192)),limitY=Math.min(positive(maxSize,8192),positive(maxViewport?.[1],8192));
 const longEdge=Math.max(width,height);
 // Sharp matches native pixel density, with supersampling on low-DPR views.
 // Its fixed floor is independent of the automatic performance controller.
 const desired=quality==='4k'?3840/longEdge:quality==='sharp'?Math.min(3840/longEdge,Math.max(dpr,1920/longEdge)):Math.max(1,Math.min(dpr,1.5)*Math.max(.5,Math.min(1,scale)));
 const ratio=Math.min(desired,limitX/width,limitY/height);
 const w=Math.max(1,Math.min(Math.floor(limitX),Math.round(width*ratio))),h=Math.max(1,Math.min(Math.floor(limitY),Math.round(height*ratio)));
 return{width:w,height:h,quality,is4k:quality==='4k'&&Math.max(w,h)>=3839,limited:quality==='4k'&&Math.max(w,h)<3839};
}
export function matchResolutionLabel(plan){return`${plan.is4k?'4K':plan.limited?'Enhedens maksimum':plan.quality==='sharp'?'Skarp 3D':'Auto'} · ${plan.width} × ${plan.height}`;}

export function isSlowMatchFrame(seconds,targetFps=30){return Number.isFinite(seconds)&&seconds>1/targetFps*1.35;}

// Auto may trade resolution for time, then recover after a sustained clear run.
// Sharp/4K never enter this controller and retain their exact output size.
export function createAutoResolutionController({targetFps=30}={}){
 targetFps=Number.isFinite(targetFps)&&targetFps>0?targetFps:30;
 const targetMs=1000/targetFps;
 let scale=1,pressureMs=0,healthyMs=0,lastChange=null,lastSample=null;
 return{get scale(){return scale;},get underPressure(){return pressureMs>=200||scale<1;},sample(seconds,now,{renderMs}={}){
  if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(now))return false;
  // A background gap is not evidence that the GPU needs a smaller framebuffer.
  if(seconds>.25||lastSample!==null&&now<lastSample){lastSample=now;pressureMs=healthyMs=0;return false;}
  const elapsedMs=lastSample===null?seconds*1000:Math.max(0,Math.min(250,now-lastSample));
  lastSample=now;if(lastChange===null)lastChange=now;
  const work=Number.isFinite(renderMs)&&renderMs>=0?renderMs:null;
  const overloaded=isSlowMatchFrame(seconds,targetFps)||work!==null&&work>targetMs*.85;
  const healthy=seconds*1000<=targetMs*1.12&&(work===null||work<targetMs*.65);
  pressureMs=overloaded?Math.min(2400,pressureMs+elapsedMs):Math.max(0,pressureMs-elapsedMs*2);
  healthyMs=healthy?healthyMs+elapsedMs:Math.max(0,healthyMs-elapsedMs*4);
  let next=scale;
  // React within about a second of sustained load, but recover slowly so one
  // quiet moment cannot make resolution oscillate. Work timing also catches a
  // nearly saturated render hidden behind a deliberately paced 30 Hz draw loop.
  if(pressureMs>=600&&now-lastChange>=1000)next=Math.max(.5,scale*.85);
  else if(healthyMs>=5000&&now-lastChange>=5000)next=Math.min(1,scale+.1);
  if(next===scale)return false;
  scale=next;pressureMs=healthyMs=0;lastChange=now;return true;
 }};
}
