// Presentation only. Sample the existing R3 acceleration/turn limits between
// authoritative ticks, without changing controls, recordings or physics.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function samplePlayerPose(p,seconds,out={}){
 const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.045);
 out.x=p.x+p.vx*dt+(p.ax||0)*dt*dt*.5;
 out.y=p.y+p.vy*dt+(p.ay||0)*dt*dt*.5;
 out.vx=p.vx+(p.ax||0)*dt;out.vy=p.vy+(p.ay||0)*dt;
 const pace=Math.hypot(out.vx,out.vy),current=Math.atan2(p.facingX,p.facingY);
 const kick=p.kick>0&&Number.isFinite(p.kickFacingX),x=kick?p.kickFacingX:out.vx,y=kick?p.kickFacingY:out.vy;
 const desired=Math.hypot(x,y)>.2?Math.atan2(x,y):current;
 const delta=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
 out.angle=current+clamp(delta,-(pace>4?4.5:7)*dt,(pace>4?4.5:7)*dt);
 return out;
}

export function createPlayerResponse(){
 const pose={forward:0,side:0};
 return {update(p,seconds,{snap=false,disabled=false,athletic=false}={}){
  const speed=athletic?Math.hypot(p.vx||0,p.vy||0):0;
  const sprintLean=Math.max(0,speed-4.2)*.020;
  const kickLean=athletic&&p.kick>0?.077*Math.sin(Math.PI*(1-.55*clamp(p.kick/Math.max(p.kick,p.actionDuration||10),0,1))):0;
  const forward=disabled?0:clamp(((p.ax||0)*p.facingX+(p.ay||0)*p.facingY)*.008+sprintLean+kickLean,-.075,athletic?.175:.1);
  const side=disabled?0:clamp(((p.ax||0)*p.facingY-(p.ay||0)*p.facingX)*.009,-.11,.11);
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05),mix=snap?1:1-Math.exp(-12*dt);
  pose.forward+=(forward-pose.forward)*mix;pose.side+=(side-pose.side)*mix;
  return pose;
 }};
}
