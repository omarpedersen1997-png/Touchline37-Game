// Observe confirmed actions and contacts independently. A stationary lastAction
// must not hide a new reception/save, and restored history is only a baseline.
export function createMatchAudioFeed(){
 let initialized=false,tick,kind,team,index,contactTick,contactKind,contactTeam,contactIndex,lastTime=-Infinity,lastTouchTime=-Infinity;
 return{observe(state,sound,now){
  const action=state.lastAction,contact=state.lastContact;
  const changed=tick!==action?.tick||kind!==action?.kind||team!==action?.team||index!==action?.index;
  const touchChanged=contactTick!==contact?.tick||contactKind!==contact?.kind||contactTeam!==contact?.team||contactIndex!==contact?.index;
  tick=action?.tick;kind=action?.kind;team=action?.team;index=action?.index;
  contactTick=contact?.tick;contactKind=contact?.kind;contactTeam=contact?.team;contactIndex=contact?.index;
  if(!initialized){initialized=true;return false;}
  if(state.freeze>0||state.replay||!sound||!Number.isFinite(now))return false;
  const r3=state.version===11&&state.engineRevision>=3,pace=Math.hypot(state.ball?.vx||0,state.ball?.vy||0,state.ball?.vz||0);
  let played=false;
  const freshAction=Number.isFinite(state.tick)?state.tick-tick>=0&&state.tick-tick<=2:!r3;
  if(changed&&freshAction&&now-lastTime>=65){
   const cue=kind==='woodwork'?'woodwork':['shot','pass','through','loft'].includes(kind)?'kick':null;
   if(cue){lastTime=now;if(kind==='shot'||kind==='woodwork')sound.chance?.();
    const power=r3&&!Number.isFinite(action.power)?Math.max(.15,Math.min(1,(pace-8)/24)):action.power;
    played=sound.impact?.(cue,power)||false;
   }
  }
  if(r3&&touchChanged&&state.tick-contactTick>=0&&state.tick-contactTick<=2&&now-lastTouchTime>=80&&['touch','save','block'].includes(contactKind)){
   lastTouchTime=now;if(contactKind==='save')sound.chance?.();
   const p=state[contactTeam]?.[contactIndex],power=Math.max(.1,Math.min(1,p?.touch||pace/28));
   played=!!sound.contact?.(contactKind,power)||played;
  }
  return played;
 },reset(){initialized=false;lastTime=lastTouchTime=-Infinity;}};
}


// A restored score is the baseline, never a new goal announcement.
export function createGoalSoundTracker(){
 let previous=null;
 return (goals,phase)=>{if(phase==='waiting'){previous=null;return false;}const changed=previous!==null&&goals>previous;previous=goals;return changed;};
}
export function createGoalAudioObserver(){
 const track=createGoalSoundTracker();
 return (sound,goals,phase,withWhistle=false)=>{
  if(!track(goals,phase))return false;
  sound?.goal();sound?.crowd();
  // Halftime/full-time already have their own stronger whistle sequence.
  if(withWhistle&&phase!=='halftime'&&phase!=='finished')sound?.whistle('goal');
  return true;
 };
}

// Loading/restoration is a baseline. Only a live transition may announce an
// old half/full-time; a quality switch must not repeat the final whistle.
export function createPhaseWhistleObserver(initial='waiting'){
 let previous=initial;
 return(sound,phase)=>{
  if(phase===previous)return false;
  const before=previous;previous=phase;
  if((phase==='halftime'||phase==='finished')&&['first','second','kickoff'].includes(before)){sound?.whistle(phase);return true;}
  if(before==='kickoff'&&(phase==='first'||phase==='second')){sound?.whistle('kickoff');return true;}
  return false;
 };
}
