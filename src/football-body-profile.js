// Visual proportions only. The authoritative collision volumes never change.
export function footballBodyProfile(number=1,keeper=false){
 const variant=((Math.trunc(number)-1)%4+4)%4;
 return {width:(keeper?1.2:1.14)+variant*.015,height:1+(variant-1.5)*.009,
  depth:(keeper?1.15:1.1)+variant*.01};
}

// Roll around the pelvis, not the soles. A foot-origin roll made a diving
// keeper collapse into the turf and exaggerated the apparent lateral jump.
export function keeperDivePose(player,heading,seconds=0,out={}){
 const duration=Math.max(1,player.actionDuration||10);
 const fraction=Math.max(0,Math.min(.045,Number(seconds)||0))/.05;
 const progress=Math.max(0,Math.min(1,1-(player.dive-fraction)/duration));
 const envelope=Math.sin(Math.PI*progress),lateral=(player.diveX||0)*Math.cos(heading)-(player.diveY||0)*Math.sin(heading);
 out.roll=-(Math.sign(lateral)||1)*envelope*1.28;
 const shift=Math.sin(out.roll)*.95;
 out.x=Math.cos(heading)*shift;out.z=-Math.sin(heading)*shift;
 out.height=.95*(1-Math.cos(out.roll))+.24*envelope;
 out.progress=progress;
 return out;
}

export function createKeeperReadiness(){
 let weight=0;
 return {update(player,state,team,seconds,{snap=false}={}){
  const ball=state.ball,other=ball?.owner?.team!==team;
  const dx=(ball?.x||0)-player.x,dy=(ball?.y||0)-player.y,distance=Math.hypot(dx,dy);
  const closing=dx*(ball?.vx||0)+dy*(ball?.vy||0)<0;
  const active=!!ball&&other&&!state.freeze&&!state.goalSequence&&!player.dive&&!player.tackle&&!player.kick&&Math.hypot(player.vx,player.vy)<3;
  const danger=active?Math.max(0,1-distance/30)*(ball.shot&&closing?1:.55):0;
  const mix=snap?1:1-Math.exp(-12*Math.max(0,Math.min(.05,seconds||0)));
  weight+=(danger-weight)*mix;
  return weight;
 }};
}
