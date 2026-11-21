// Motor 11 revision 3 only. Metres, seconds and the engine's x/y ground plane;
// z is height. Fixed 50 ms simulation, bounded fractional steps for prediction.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const length=(x,y)=>Math.sqrt(x*x+y*y);
export const BALL_PROFILES=Object.freeze({
 pass:Object.freeze({air:.006,roll:.32,friction:1.15,bounce:.36,skid:.9}),
 through:Object.freeze({air:.0055,roll:.22,friction:1.05,bounce:.32,skid:.94}),
 loft:Object.freeze({air:.008,roll:.36,friction:1.2,bounce:.48,skid:.83}),
 shot:Object.freeze({air:.0048,roll:.24,friction:1.1,bounce:.44,skid:.9}),
 loose:Object.freeze({air:.007,roll:.34,friction:1.2,bounce:.43,skid:.87})
});
export function integrateLivingBall(b,seconds=.05){
 const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05);if(!dt)return b;
 const profile=BALL_PROFILES[b.flightKind]||BALL_PROFILES.loose,air=b.z>.225||b.vz>.08;
 // Magnus force turns the velocity without adding translational energy.
 const angle=(b.curl||0)*.035*dt*(air?1:.2),cos=Math.cos(angle),sin=Math.sin(angle),vx=b.vx;
 b.vx=vx*cos-b.vy*sin;b.vy=vx*sin+b.vy*cos;b.curl=(b.curl||0)*Math.exp(-(air?1.1:4)*dt);
 if(air){
  const speed=Math.sqrt(b.vx*b.vx+b.vy*b.vy+b.vz*b.vz),drag=1/(1+profile.air*speed*dt);
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt-4.905*dt*dt;
  b.vx*=drag;b.vy*=drag;b.vz=(b.vz-9.81*dt)*drag;
  if(b.z<.22){b.z=.22;b.vz=Math.abs(b.vz)>.9?-b.vz*profile.bounce:0;b.vx*=profile.skid;b.vy*=profile.skid;}
 }else{
  const speed=length(b.vx,b.vy),next=Math.max(0,speed*Math.exp(-profile.roll*dt)-profile.friction*dt),ratio=speed?next/speed:0;
  b.x+=(b.vx+b.vx*ratio)*.5*dt;b.y+=(b.vy+b.vy*ratio)*.5*dt;
  b.vx*=ratio;b.vy*=ratio;b.z=.22;b.vz=0;
 }
 return b;
}
export function turnFacing(p,x,y,dt=.05){
 if(length(x,y)<.001)return;
 const desired=Math.atan2(x,y),current=Math.atan2(p.facingX,p.facingY),difference=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
 const pace=length(p.vx,p.vy),rate=pace>4?4.5:7,angle=current+clamp(difference,-rate*dt,rate*dt);
 p.facingX=Math.sin(angle);p.facingY=Math.cos(angle);
}
export function moveLivingPlayer(p,tx,ty,speed,arrive=false,seconds=.05){
 const dt=clamp(seconds,0,.05);if(!dt)return;
 const dx=tx-p.x,dy=ty-p.y,d=length(dx,dy),pace=length(p.vx,p.vy);
 const wanted=d>.1?Math.min(speed,d/dt,arrive?Math.sqrt(16*Math.max(0,d-.05)):speed):0;
 const vx=d?dx/d*wanted:0,vy=d?dy/d*wanted:0;
 const limit=wanted?12:18,ax=(vx-p.vx)*6,ay=(vy-p.vy)*6,a=length(ax,ay),scale=a>limit?limit/a:1;
 const priorAx=p.ax||0,priorAy=p.ay||0,jx=ax*scale-priorAx,jy=ay*scale-priorAy,jerk=length(jx,jy),blend=jerk?Math.min(1,55*dt/jerk):1;
 p.ax=priorAx+jx*blend;p.ay=priorAy+jy*blend;
 const oldX=p.vx,oldY=p.vy;p.vx+=p.ax*dt;p.vy+=p.ay*dt;
 if(!wanted&&oldX*p.vx+oldY*p.vy<=0){p.vx=p.vy=p.ax=p.ay=0;}
 const next=length(p.vx,p.vy),maximum=Math.max(speed,pace);
 if(wanted&&next>maximum&&next){p.vx*=maximum/next;p.vy*=maximum/next;}
 if(p.kick>0&&Number.isFinite(p.kickFacingX))turnFacing(p,p.kickFacingX,p.kickFacingY,dt);
 else if(next>.2)turnFacing(p,p.vx,p.vy,dt);
 p.x=clamp(p.x+p.vx*dt,-29.5,29.5);p.y=clamp(p.y+p.vy*dt,-47.4,47.4);
 p.gait=(p.gait+next*dt*.82)%(Math.PI*2);
 for(const key of ['x','y','vx','vy','ax','ay','facingX','facingY','gait'])p[key]=Math.round(p[key]*10000)/10000;
}
export function receiveLivingBall(b,p,{skill=50,pressure=10,keeper=false}={}){
 const relative=length(b.vx-p.vx,b.vy-p.vy),incoming=length(b.vx,b.vy),angle=incoming?clamp((1+(b.vx*p.facingX+b.vy*p.facingY)/incoming)*.5,0,1):0;
 const retained=keeper?0:clamp(.23-skill*.0012+Math.max(0,2.4-pressure)*.045+angle*.06,.06,.32);
 b.vx=p.vx+(b.vx-p.vx)*retained;b.vy=p.vy+(b.vy-p.vy)*retained;
 b.vz=keeper?0:Math.max(0,Math.min(.8,-b.vz*.1));b.z=Math.max(.22,Math.min(keeper?.22:.85,b.z));
 b.receiveAge=0;b.receiveSoftness=clamp(relative/28+Math.max(0,2.4-pressure)*.12-skill*.003,.05,.8);
 return clamp(relative/(20+skill*.22),.2,.95);
}
export function carryLivingBall(b,p,tx,ty,speed,phase){
 const dt=.05,age=b.receiveAge||0,soft=(b.receiveSoftness||0)*Math.max(0,1-age/7),omega=14-soft*4;
 const critical=(position,velocity,target,targetVelocity)=>{
  const delta=position-(target-targetVelocity*dt),relative=velocity-targetVelocity,temp=(relative+omega*delta)*dt,decay=Math.exp(-omega*dt);
  return{position:target+(delta+temp)*decay,velocity:targetVelocity+(relative-omega*temp)*decay};
 };
 const x=critical(b.x,b.vx,tx,p.vx),y=critical(b.y,b.vy,ty,p.vy);
 b.x=x.position;b.y=y.position;b.vx=x.velocity;b.vy=y.velocity;
 const height=.22+Math.max(0,Math.sin(phase*Math.PI*2))*speed*.006,oldZ=b.z;
 b.z+=(height-b.z)*(1-Math.exp(-16*dt));b.vz=(b.z-oldZ)/dt;
 b.receiveAge=age+1;
}
