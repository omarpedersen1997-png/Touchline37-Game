const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function livingCameraPlan(state,aspect=1,{offset={x:30,z:3},height=13.7,fov=42,reducedMotion=false}={}) {
 const b=state.ball,p=state.home[state.controlled],kickoff=state.openingKickoff&&state.freeze>0||state.goalSequence?.stage==='kickoff';
 const lead=reducedMotion||kickoff ? 0 : b.owner ? .2 : .28;
 const separation=Math.hypot(p.x-b.x,p.y-b.y),weight=separation<16?.18:.05;
 const x=kickoff?0:clamp(b.x+(p.x-b.x)*weight+clamp((b.vx||0)*lead,-3,3),-28,28);
 const z=kickoff?0:clamp(b.y+(p.y-b.y)*weight+clamp((b.vy||0)*lead,-4,4),-45,45);
 // At most 8% refit; never zoom way out to follow a distant selected defender.
 const framing=reducedMotion||kickoff?1:1+clamp((b.z-.22)*.012+Math.max(0,separation-8)*.002,0,.08);
 const fit=Math.max(1,1.2/Math.max(.5,aspect)),scale=fit*.72*framing;
 return {eye:[x+offset.x*scale,height*fit*framing,z+offset.z*scale],target:[x,.8,z],fov};
}
export function createLivingCameraRig(){
 const pose={eye:[0,0,0],target:[0,0,0],fov:42},velocity={eye:[0,0,0],target:[0,0,0]};let initialized=false;
 return {update(plan,seconds,{snap=false,reducedMotion=false}={}){
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05),omega=reducedMotion?9:7;
  for(const part of ['eye','target'])for(let i=0;i<3;i++){
   if(!initialized||snap){pose[part][i]=plan[part][i];velocity[part][i]=0;continue;}
   const delta=pose[part][i]-plan[part][i],temp=(velocity[part][i]+omega*delta)*dt,decay=Math.exp(-omega*dt);
   pose[part][i]=plan[part][i]+(delta+temp)*decay;velocity[part][i]=(velocity[part][i]-omega*temp)*decay;
  }
  pose.fov=plan.fov;initialized=true;return pose;
 }};
}
