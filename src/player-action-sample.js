const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createLocomotionSelector(){
 let mode='idle';
 return (speed,celebrate=false)=>{
  if(celebrate)return 'cheer';
  if(mode==='run'){if(speed<3.4)mode=speed<.18?'idle':'walk';}
  else if(speed>4.1)mode='run';
  else if(mode==='idle'){if(speed>.3)mode='walk';}
  else if(speed<.18)mode='idle';
  return mode;
 };
}
// Contact-first authored clips follow the player's own authoritative lifetime,
// not the last action of all 22 players. Never changes a ball/player state.
export function sampleFootballAction(p,state,team,index,base,time,out={},subtick=0){
 out.clip=base;out.time=time;out.action=false;
 const fraction=state.freeze>0||state.replayHold?0:Math.max(0,Math.min(.045,Number(subtick)||0))/.05;
 const recent=state.lastAction,own=recent?.team===team&&recent?.index===index;
 if(p.dive>0){const duration=p.action==='dive'?p.actionDuration||16:16;out.clip='dive';out.time=clamp(1-(p.dive-fraction)/duration,0,.9999)*.85;out.action=true;}
 else if(p.tackle>0){const duration=p.action==='tackle'?p.actionDuration||16:16;out.clip='tackle';out.time=clamp(1-(p.tackle-fraction)/duration,0,.9999)*.8;out.action=true;}
 else if(p.kick>0&&(p.action==='kick'||p.action==null&&own)){
  const duration=p.actionDuration||((own&&recent.kind==='shot')?10:7),shoot=duration>=10;
  out.clip=shoot?'shoot':'pass';out.time=(.45+.55*clamp(1-(p.kick-fraction)/duration,0,.9999))*(shoot?.7:.55);out.action=true;
 }else if(team==='home'&&index===state.controlled&&state.ball?.owner?.team===team&&state.ball.owner.index===index&&(state.shotCharge>0||state.passCharge>0)){
  const shoot=state.shotCharge>0;out.clip=shoot?'shoot':'pass';out.time=.45*clamp(((shoot?state.shotCharge:state.passCharge)+fraction)/18,0,1)*(shoot?.7:.55);out.action=true;
 }
 return out;
}
