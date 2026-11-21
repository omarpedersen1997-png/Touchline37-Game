import {Quaternion,Vector3} from 'three';

// World-space rolling follows metres travelled, not an arbitrary slow spin.
// One local instance per scene; no allocations, layout reads or physics writes.
export function createBallRoll(radius=.22){
 const axis=new Vector3(),rotation=new Quaternion();let x=0,y=0,ready=false;
 return {update(object,point,ball,seconds,{reset=false,paused=false,radius:renderRadius=radius}={}){
  const dt=Math.max(0,Math.min(.05,Number.isFinite(seconds)?seconds:0));
  const dx=point.x-x,dy=point.y-y;x=point.x;y=point.y;
  if(!ready||reset){ready=true;return;}
  if(paused||dt===0)return;
  const grounded=point.z<.4&&Math.abs(ball.vz||0)<1;
  const sx=grounded?dx:(ball.vx||0)*dt*.35,sy=grounded?dy:(ball.vy||0)*dt*.35;
  const distance=Math.hypot(sx,sy);
  if(distance<1e-8||distance>Math.max(2,Math.hypot(ball.vx,ball.vy)*dt*2+.25))return;
  axis.set(sy/distance,0,-sx/distance);rotation.setFromAxisAngle(axis,distance/Math.max(.08,renderRadius));
  object.quaternion.premultiply(rotation).normalize();
 },reset(){ready=false;}};
}
