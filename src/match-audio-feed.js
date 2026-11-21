// Observe only the latest real action; never replay old kicks after reopening.
export function createMatchAudioFeed(){
 let seen=null,lastTime=-Infinity;
 return {observe(state,sound,now){
  const action=state.lastAction,key=action?`${action.tick}:${action.kind}:${action.team}:${action.index}`:'';
  if(seen===null){seen=key;return false;}if(seen===key)return false;seen=key;
  if(state.tick-action?.tick>2||state.freeze>0||state.replay||!sound||!Number.isFinite(now)||now-lastTime<65)return false;
  const kind=action?.kind==='woodwork'?'woodwork':['shot','pass','through','loft'].includes(action?.kind)?'kick':null;
  if(!kind)return false;lastTime=now;return sound.impact?.(kind,action.power)||false;
 },reset(){seen=null;lastTime=-Infinity;}};
}
