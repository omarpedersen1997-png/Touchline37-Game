import {livingCameraPlan} from './living-camera.js';
// Broadcast camera keeps a fixed heading so screen-relative input never flips.
export const BROADCAST_OFFSET={x:40,z:12};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function screenToPitch(x,y,view){
 if(view==='diagram')return{x:y,y:-x};
 if(!['broadcast','pro','tactical'].includes(view))return{x,y};
 const {x:cx,z:cz}=view==='pro'?PRO_OFFSET:BROADCAST_OFFSET,r=Math.hypot(cx,cz);
 return{x:(x*cz+y*cx)/r,y:(-x*cx+y*cz)/r};
}
export function matchCamera(state,view,aspect=1,options={}){
 if(view==='pro')return proCamera(state,aspect,options);
 const field=state.field||{width:40,length:64},p=state.home[state.controlled],ball=state.ball;
 if(view==='broadcast')return proCamera(state,aspect,{offset:BROADCAST_OFFSET,height:state.version>=7?15.5:state.version>=6?17:state.version>=5?21:29,fov:state.version>=6?44:state.version>=5?46:52,...options});
 if(view==='follow'){const narrow=aspect<.85;return{eye:[p.x,narrow?13:9.5,p.y+(narrow?21:16)],target:[p.x,1,p.y-10]};}
 return{eye:[0,Math.max(field.length*1.07,field.width/Math.max(.5,aspect)*1.1),field.length*.65],target:[0,0,0]};
}

// The pro lens follows the play, not the player's heading: controls never rotate.
export const PRO_OFFSET={x:30,z:3};
export function proCamera(state,aspect=1,profile={}){
 if(state.version===11&&state.engineRevision>=3)return livingCameraPlan(state,aspect,profile);
 const offset=profile.offset||PRO_OFFSET,height=profile.height||(state.version>=7?13.7:state.version>=6?15:state.version>=5?19:18),baseFov=profile.fov||(state.version>=6?42:state.version>=5?44:56);
 const p=state.home[state.controlled],b=state.ball;
 // Professional matches use a fixed lens. Ball/player separation must never
 // change camera distance or FOV; only an actual viewport resize may refit it.
 if(state.version>=5){const zoom=Math.max(1,1.2/Math.max(.5,aspect)),pw=state.version>=6?(state.personalIndex===null?.2:.6):.7,lens=state.version>=7?.72:state.version>=6?.8:1,x=state.version>=6?clamp(clamp(p.x*pw+b.x*(1-pw),b.x-3,b.x+3),-27,27):clamp(p.x*pw+b.x*(1-pw),-23,23),z=state.version>=6?clamp(clamp(p.y*pw+b.y*(1-pw),b.y-3,b.y+3),-43,43):clamp(p.y*pw+b.y*(1-pw),-39,39);return{eye:[x+offset.x*zoom*lens,height*zoom,z+offset.z*zoom*lens],target:[x,.8,z],fov:baseFov};}
 const separation=Math.hypot(p.x-b.x,p.y-b.y),lead=b.owner?0.24:0.4;
 const x=clamp(p.x*.55+b.x*.45+(b.vx||0)*lead,-23,23),z=clamp(p.y*.55+b.y*.45+(b.vy||0)*lead,-39,39),safeAspect=Math.max(.35,aspect);
 let zoom=Math.max(1,Math.sqrt(.9/safeAspect),separation/35);
 // Fit both the controlled player and the ball, including tall phone viewports.
 // The camera heading stays fixed while the lens pulls out for long passes.
 const fits=(scale,fov=baseFov)=>{const ex=offset.x*scale,ey=height*scale-.8,ez=offset.z*scale,h=Math.hypot(ex,ez),r=Math.hypot(h,ey),tan=Math.tan(fov/2*Math.PI/180);return[p,b].every(point=>{const dx=point.x-x,dy=(point.z||1)-.8,dz=point.y-z,depth=r-(dx*ex+dy*ey+dz*ez)/r;if(depth<=0)return false;const sx=(dx*ez-dz*ex)/h/(depth*tan*safeAspect),sy=(-dx*ex*ey/(r*h)+dy*h/r-dz*ez*ey/(r*h))/(depth*tan);return Math.abs(sx)<.8&&Math.abs(sy)<.65;});};
 while(zoom<6&&!fits(zoom))zoom*=1.12;zoom=Math.min(6,zoom);let fov=baseFov;while(fov<78&&!fits(zoom,fov))fov+=2;
 return{eye:[x+offset.x*zoom,height*zoom,z+offset.z*zoom],target:[x,.8,z],fov};
}
