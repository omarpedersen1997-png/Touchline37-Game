// Observe real actions without allocating strings on every rendered frame.
export function createMatchAudioFeed(){
 let initialized=false,tick,kind,team,index,lastTime=-Infinity;
 return {observe(state,sound,now){
  const action=state.lastAction;
  if(initialized&&tick===action?.tick&&kind===action?.kind&&team===action?.team&&index===action?.index)return false;
  const first=!initialized;initialized=true;tick=action?.tick;kind=action?.kind;team=action?.team;index=action?.index;
  if(first||state.tick-action?.tick>2||state.freeze>0||state.replay||!sound||!Number.isFinite(now)||now-lastTime<65)return false;
  const cue=kind==='woodwork'?'woodwork':(kind==='shot'||kind==='pass'||kind==='through'||kind==='loft')?'kick':null;
  if(!cue)return false;lastTime=now;return sound.impact?.(cue,action.power)||false;
 },reset(){initialized=false;lastTime=-Infinity;}};
}
