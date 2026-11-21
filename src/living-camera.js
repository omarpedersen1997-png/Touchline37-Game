const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function livingCameraPlan(state,aspect=1,{offset={x:30,z:3},height=13.7,fov=42,reducedMotion=false,ballPosition,playerPosition}={}) {
 const b=state.ball,p=state.home[state.controlled],kickoff=state.openingKickoff&&state.freeze>0||state.goalSequence?.stage==='kickoff';
 const bx=ballPosition?.x??b.x,by=ballPosition?.y??b.y,bz=ballPosition?.z??b.z,px=playerPosition?.x??p.x,py=playerPosition?.y??p.y;
 const lead=reducedMotion||kickoff ? 0 : b.owner ? .06 : .1;
 const separation=Math.hypot(px-bx,py-by),weight=separation<16?.18:.05;
 const x=kickoff?0:clamp(bx+(px-bx)*weight+clamp((b.vx||0)*lead,-3,3),-28,28);
 const z=kickoff?0:clamp(by+(py-by)*weight+clamp((b.vy||0)*lead,-4,4),-45,45);
 // At most 8% refit; never zoom way out to follow a distant selected defender.
 const framing=reducedMotion||kickoff?1:1+clamp((bz-.22)*.012+Math.max(0,separation-8)*.002+Math.hypot(b.vx||0,b.vy||0)*.0006,0,.08);
 // The old linear portrait refit more than doubled the camera distance.
 // A square-root refit preserves useful width without making figures tiny.
 const fit=Math.max(1,Math.sqrt(1.2/Math.max(.5,aspect))),proximity=.64;
 const scale=fit*.72*proximity*framing;
 // Follow loft height with a bounded target lift; no zoom chase after a
 // distant selected defender. The heading remains fixed for the joystick.
 const targetHeight=(reducedMotion||kickoff) ? .8 : .8+clamp((bz-.8)*.42,0,3.2);
 return {eye:[x+offset.x*scale,height*fit*proximity*framing,z+offset.z*scale],target:[x,targetHeight,z],fov:Math.max(35,fov-2)};
}
export function createLivingCameraRig({response=14,feedforward=true}={}){
 const pose={eye:[0,0,0],target:[0,0,0],fov:42},velocity={eye:[0,0,0],target:[0,0,0]},previous={eye:[0,0,0],target:[0,0,0]},priorSpeed={eye:[0,0,0],target:[0,0,0]};let initialized=false;
 return {update(plan,seconds,{snap=false,reducedMotion=false}={}){
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05),omega=reducedMotion?9:Math.max(9,Math.min(18,response));
  for(const part of ['eye','target'])for(let i=0;i<3;i++){
   if(!initialized||snap){pose[part][i]=plan[part][i];velocity[part][i]=0;previous[part][i]=plan[part][i];priorSpeed[part][i]=0;continue;}
   const movement=plan[part][i]-previous[part][i],speed=dt>0?movement/dt:0,prior=priorSpeed[part][i];
   const continuous=dt>0&&Math.abs(speed)<=40&&speed*prior>0&&Math.abs(speed/prior)>=.25&&Math.abs(speed/prior)<=4;
   const following=feedforward&&!reducedMotion&&continuous?speed:0;if(dt>0)priorSpeed[part][i]=Math.abs(speed)<=40?speed:0;
   const delta=pose[part][i]-(plan[part][i]-following*dt),relative=velocity[part][i]-following,temp=(relative+omega*delta)*dt,decay=Math.exp(-omega*dt);
   pose[part][i]=plan[part][i]+(delta+temp)*decay;velocity[part][i]=following+(relative-omega*temp)*decay;if(dt>0)previous[part][i]=plan[part][i];
  }
  pose.fov=plan.fov;initialized=true;return pose;
 }};
}
