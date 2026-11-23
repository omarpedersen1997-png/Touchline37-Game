// Local coordinates: +x is the athlete's right, +y up, +z forward.
// Store the joint centres and planting state once. Both renderers read the
// same skeletal pose; the simulation and its contact geometry are untouched.
export const JOINT = Object.freeze({
  pelvis:0, chest:3, neck:6, head:9,
  hipL:12, kneeL:15, ankleL:18, bootL:21,
  hipR:24, kneeR:27, ankleR:30, bootR:33,
  shoulderL:36, elbowL:39, handL:42,
  shoulderR:45, elbowR:48, handR:51,
});

const CYCLE = 1.82;
const SUPPORT = .57;
const BOOT_Y = .060;
const clamp = (x,lo,hi) => Math.max(lo,Math.min(hi,x));
const set = (p,id,x,y,z) => {p[id]=x;p[id+1]=y;p[id+2]=z;};

export function createPlayerStride(seed=0) {
  return {
    joints:new Float32Array(54), phase:(seed*.371)%1, previousX:NaN, previousZ:NaN,
    feet:new Float32Array(6), plant:new Uint8Array(2),
    directionX:0,directionZ:1, gait:0, leanX:0, leanZ:0, kick:0,
  };
}

function solveLeg(p, hip, knee, ankle) {
  const x=p[ankle]-p[hip],y=p[ankle+1]-p[hip+1],z=p[ankle+2]-p[hip+2];
  const length=Math.hypot(x,y,z)||1;
  const bend=Math.sqrt(Math.max(0,.423*.423-length*length*.25));
  // Bend forward in a direction perpendicular to hip→ankle.
  const fx=-x*z/(length*length),fy=-y*z/(length*length),fz=1-z*z/(length*length);
  const normal=bend/(Math.hypot(fx,fy,fz)||1);
  set(p,knee,p[hip]+x*.5+fx*normal,p[hip+1]+y*.5+fy*normal,p[hip+2]+z*.5+fz*normal);
}

export function samplePlayerStride(state, player, x, z, heading, elapsed, subtick=0, snap=false, charge=0) {
  const joints=state.joints, speed=Math.hypot(player.vx||0,player.vy||0);
  const dt=clamp(elapsed,0,.12), sin=Math.sin(heading), cos=Math.cos(heading);
  const distance=Math.hypot(x-state.previousX,z-state.previousZ);
  state.previousX=x;state.previousZ=z;
  const reset=snap||!Number.isFinite(distance)||distance>1.6;
  if(!reset&&dt>0)state.phase=(state.phase+distance/CYCLE)%1;
  const phase=state.phase;
  const change=reset?1:1-Math.exp(-14*dt);
  const vx=player.vx||0,vz=player.vy||0,divisor=speed||1;
  const localX=(vx*cos-vz*sin)/divisor,localZ=(vx*sin+vz*cos)/divisor;
  const air=clamp((speed-.18)/2.6,0,1);
  const accelerationX=(player.ax||0)*cos-(player.ay||0)*sin;
  const locomotionLean=clamp(speed*.021,0,.17);
  state.gait+=(air-state.gait)*change;
  state.directionX+=(localX-state.directionX)*change;
  state.directionZ+=((speed>.1?localZ:1)-state.directionZ)*change;
  state.leanX+=(clamp(localX*locomotionLean+accelerationX*.013,-.19,.19)-state.leanX)*change;
  state.leanZ+=(localZ*locomotionLean-state.leanZ)*change;

  const striking=player.kick>0;
  const release=striking?clamp(1-(player.kick-clamp(subtick,0,.05)/.05)/Math.max(player.kick,player.actionDuration||10),0,1):0;
  const progress=striking?.45+.55*release:.45*clamp(charge,0,1);
  const actionBlend=striking?clamp((1-release)/.19,0,1):clamp(charge*2,0,1);
  const follow=Math.sin(Math.PI*progress)*Math.sin((progress-.27)*Math.PI)*actionBlend;
  const leftPlant=actionBlend>.001;

  const lowStance=player.tackle>0?.13:0;
  const movement=state.gait, directionX=state.directionX,directionZ=state.directionZ;

  for(let side=0;side<2;side++){
    const sign=side*2-1, footPhase=(phase+side*.5)%1;
    const stance=footPhase<SUPPORT;
    const t=stance?footPhase/SUPPORT:(footPhase-SUPPORT)/(1-SUPPORT);
    const advance=stance?(.5-t)*CYCLE*SUPPORT:(t*t*(3-2*t)-.5)*CYCLE*SUPPORT;
    const lift=stance?0:Math.sin(t*Math.PI)*(.115+speed*.012);
    let fx=sign*.108+advance*movement*directionX, fz=advance*movement*directionZ;
    let fy=lift*movement;
    if(leftPlant){
      if(side===0){fy*=1-actionBlend;fz+=(.11-fz)*actionBlend;}
      else{
        fy+=(Math.sin(Math.PI*progress)*.32-fy)*actionBlend;
        fz=fz*(1-actionBlend)+follow*.70;fx+=Math.sin(progress*Math.PI)*.048*actionBlend;
      }
    }
    set(state.feet,side*3,fx,fy,fz);
    state.plant[side]=(actionBlend>=.999?side===0:stance&&fy<.002||movement<.01&&fy<.002)?1:0;
  }

  const leanX=state.leanX,leanZ=state.leanZ+(leftPlant?Math.sin(progress*Math.PI)*.12:0);
  const hipTwist=Math.sin(phase*Math.PI*2)*.054*movement-follow*.105;
  const chestTwist=-hipTwist*.76;
  const hipRoll=Math.sin(phase*Math.PI*2)*.018*movement;
  let hipY=.884-.031*movement-lowStance+.019*Math.cos(phase*Math.PI*4)*movement;
  for(let side=0;side<2;side++){
    const f=side*3,sign=side*2-1,dx=state.feet[f]-sign*.102,dz=state.feet[f+2]-sign*hipTwist;
    hipY=Math.min(hipY,.102+state.feet[f+1]+Math.sqrt(Math.max(.04,.842*.842-dx*dx-dz*dz))-sign*hipRoll);
  }
  set(joints,JOINT.pelvis,0,hipY,0);
  set(joints,JOINT.chest,leanX*.73,hipY+.408,leanZ*.76);
  set(joints,JOINT.neck,leanX*.95,hipY+.563,leanZ);
  set(joints,JOINT.head,leanX,hipY+.692,leanZ+.016);
  for(let side=0;side<2;side++){
    const f=side*3,sign=side*2-1,leg=JOINT.hipL+side*12,arm=JOINT.shoulderL+side*9;
    const swing=Math.cos((phase+side*.5)*Math.PI*2)*movement;
    const fx=state.feet[f],fy=state.feet[f+1],fz=state.feet[f+2];
    set(joints,leg,sign*.102,hipY+sign*hipRoll,hipTwist*sign);
    set(joints,leg+6,fx,fy+.102,fz);
    solveLeg(joints,leg,leg+3,leg+6);
    set(joints,leg+9,fx,fy+BOOT_Y,fz+.075);
    const armX=leanX*.78+sign*.187,armY=hipY+.457,armZ=leanZ*.78+chestTwist*sign;
    const armForward=-swing*.22+sign*follow*.11;
    set(joints,arm,armX,armY,armZ);
    set(joints,arm+3,armX+sign*(.036+.038*movement),armY-.238,armZ+armForward);
    set(joints,arm+6,armX+sign*.067,armY-.426+.105*movement,armZ+armForward*1.32+.055+.097*movement);
  }
  state.kick=follow;
  return joints;
}
