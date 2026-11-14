const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const bounded=(value,fallback,min,max)=>Number.isFinite(value)?clamp(value,min,max):fallback;
const goals=state=>(state.events||[]).filter(event=>event?.kind==='goal');

function freezeTree(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
 for(const child of Object.values(value))freezeTree(child);
 return Object.freeze(value);
}

function snapshot(state){
 // lastGoal already contains another set of players. Its one useful endpoint
 // is copied separately; repeating it in every rolling frame wastes memory.
 const {lastGoal,...visual}=state;
 return freezeTree(structuredClone(visual));
}

function validState(state){
 return state&&Number.isFinite(state.tick)&&state.tick>=0&&Number.isFinite(state.homeScore)&&Number.isFinite(state.awayScore)&&Array.isArray(state.home)&&Array.isArray(state.away)&&state.ball;
}

function goalEndpoint(state,event,previousTime,tickMs){
 const goal=state.lastGoal;
 if(!goal||goal.side!==event.side||!Number.isFinite(goal.tick)||goal.tick>state.tick||!Number.isFinite(goal.time)||!goal.point||!['x','y','z'].every(key=>Number.isFinite(goal.point[key]))||!Array.isArray(goal.home)||!Array.isArray(goal.away)||!goal.ball)return null;
 const time=(goal.tick-1+clamp(goal.time,0,1))*tickMs;
 if(time<previousTime||time>state.tick*tickMs)return null;
 const visual=structuredClone(snapshot(state));
 visual.home=structuredClone(goal.home);visual.away=structuredClone(goal.away);visual.ball=structuredClone(goal.ball);visual.controlled=goal.controlled;
 visual.tick=time/tickMs;visual.freeze=0;
 if(visual.goalSequence?.startedTick===goal.tick){
  visual.goalSequence={...visual.goalSequence,stage:'net',elapsedTicks:0,stageTicks:0,impact:null};
 }else if(visual.goalSequence)visual.goalSequence=null;
 return{time,state:freezeTree(visual),cut:false};
}

function completeClip(clip,frames=clip.frames){
 const endMs=frames.at(-1).time;
 return Object.freeze({...clip,endMs,durationMs:Math.max(1,endMs-clip.startMs+clip.holdMs),ready:true,frames:Object.freeze(frames)});
}

/**
 * Capture genuine local match states; never changes a control tape or score.
 * At 10Hz the default rolling lead holds at most32 frames. Engine10 also keeps
 * the real net follow-through (at most11 extra frames per clip). Older engines
 * hold their genuine crossing rather than fabricating post-goal ball travel.
 */
export function createGoalReplayBuffer({sampleMs=100,leadMs=3000,tailMs=1000,maxClips=3,tickMs=50}={}){
 sampleMs=bounded(sampleMs,100,50,1000);leadMs=bounded(leadMs,3000,0,10000);tailMs=bounded(tailMs,1000,0,3000);maxClips=Math.floor(bounded(maxClips,3,1,5));tickMs=bounded(tickMs,50,10,1000);
 const rollingLimit=Math.ceil(leadMs/sampleMs)+2,clipLimit=rollingLimit+1,tailFrameLimit=Math.ceil(tailMs/sampleMs)+1;
 let rolling=[],allClips=[],lastTime=null,lastSample=null,observedGoals=0,homeScore=0,awayScore=0,finished=false;

 const reset=()=>{rolling=[];allClips=[];lastTime=null;lastSample=null;observedGoals=0;homeScore=0;awayScore=0;finished=false;};
 const readyThrough=(time,force=false)=>{
  let changed=false;
  allClips=allClips.map(clip=>{
   if(!clip.ready&&(force||time>=clip.readyAt)){changed=true;return completeClip(clip);}
   return clip;
  });
  return changed;
 };
 const addFrame=(state,time,force=false)=>{
  if(!force&&lastSample!==null&&time-lastSample<sampleMs)return;
  if(rolling.at(-1)?.time===time)return;
  const prior=rolling.at(-1)?.state;
  const cut=!!prior&&((state.freeze>0&&!(prior.freeze>0))||(state.restart?.tick!==undefined&&state.restart.tick!==(prior.restart?.tick)));
  rolling.push(Object.freeze({time,state:snapshot(state),cut}));lastSample=time;
  while(rolling.length>rollingLimit||rolling.length>1&&rolling[1].time<time-leadMs)rolling.shift();
 };
 const captureNetTail=(state,time)=>{
  let changed=false;
  allClips=allClips.map(clip=>{
   if(clip.ready||clip.sequenceStartedTick===undefined)return clip;
   const sequence=state.goalSequence;
   // Kickoff and halftime reset positions. Stop on the last observed net state
   // instead of joining that scene cut to a fictional path across the pitch.
   if(sequence?.startedTick!==clip.sequenceStartedTick||sequence.stage!=='net'||time>clip.readyAt){changed=true;return completeClip(clip);}
   const previous=clip.frames.at(-1);
   if(time<=previous.time||time-previous.time<sampleMs)return clip;
   if(clip.frames.length>=clip.frameLimit)return clip;
   return Object.freeze({...clip,endMs:time,durationMs:Math.max(1,time-clip.startMs+clip.holdMs),frames:Object.freeze([...clip.frames,Object.freeze({time,state:snapshot(state),cut:false})])});
  });
  return changed;
 };

 function capture(state,force=false){
  if(finished||!validState(state))return false;
  const time=state.tick*tickMs,currentGoals=goals(state);
  if(lastTime!==null&&time<lastTime)reset();
  if(lastTime===time&&!force)return false;
  const previousTime=lastTime;
  let changed=false;
  // A background jump is not footage. Never bridge missing seconds or build
  // a replay for goals that occurred while capture was absent.
  const gap=previousTime!==null&&time-previousTime>Math.max(1000,sampleMs*4);
  if(gap){changed=readyThrough(time,true)||changed;rolling=[];lastSample=null;}
  else changed=captureNetTail(state,time)||changed;
  changed=readyThrough(time)||changed;

  if(previousTime!==null&&!gap&&currentGoals.length===observedGoals+1){
   const event=currentGoals.at(-1),homeDelta=state.homeScore-homeScore,awayDelta=state.awayScore-awayScore;
   const actualScore=event.side==='home'?homeDelta===1&&awayDelta===0:event.side==='away'&&awayDelta===1&&homeDelta===0;
   if(actualScore){
    const endpoint=goalEndpoint(state,event,previousTime,tickMs),goalTime=endpoint?.time??time;
    const frames=rolling.filter(frame=>frame.time>=goalTime-leadMs&&frame.time<goalTime);
    if(endpoint)frames.push(Object.freeze(endpoint));
    // Old engines expose no pre-kickoff crossing. Their existing frames can
    // honestly show the build-up, but never an invented goal or reset flight.
    if(frames.length>=(endpoint?1:2)){
     while(frames.length>clipLimit)frames.shift();
     const startMs=frames[0].time,endMs=frames.at(-1).time;
     const netTail=state.version>=10&&endpoint&&state.goalSequence?.startedTick===state.lastGoal?.tick&&state.goalSequence.stage==='net'&&tailMs>0;
     const holdMs=netTail?Math.min(350,tailMs):tailMs;
     const clip=Object.freeze({
      id:`goal-${currentGoals.length}-${Math.round(goalTime)}`,team:event.side,minute:event.minute,
      homeScore:state.homeScore,awayScore:state.awayScore,kind:endpoint?'goal':'build-up',hasGoalFrame:!!endpoint,
      goalTime,startMs,endMs,holdMs,durationMs:Math.max(1,endMs-startMs+holdMs),
      readyAt:time+tailMs,ready:tailMs===0,frames:Object.freeze(frames),
      ...(netTail?{sequenceStartedTick:state.goalSequence.startedTick,frameLimit:clipLimit+tailFrameLimit}:{})
     });
     allClips.push(clip);while(allClips.length>maxClips)allClips.shift();
     if(clip.ready)changed=true;
    }
   }
  }
  addFrame(state,time,force);lastTime=time;observedGoals=currentGoals.length;homeScore=state.homeScore;awayScore=state.awayScore;
  return changed;
 }

 return{
  capture:state=>capture(state),
  finish(state){if(finished)return false;let changed=capture(state,true);changed=readyThrough(lastTime??0,true)||changed;finished=true;return changed;},
  reset,
  get clips(){return allClips.filter(clip=>clip.ready);},
  get bufferedFrameCount(){return rolling.length+allClips.reduce((n,clip)=>n+clip.frames.length,0);}
 };
}

const lerp=(a,b,t)=>a+(b-a)*t;
const playerNumbers=['x','y','vx','vy','energy','kick','tackle','touch','dive','diveX','diveY','receive','cooldown','actionTicks'];
function interpolatePlayer(a,b,t){
 const player=structuredClone(a);
 for(const key of playerNumbers)if(Number.isFinite(a[key])&&Number.isFinite(b[key]))player[key]=lerp(a[key],b[key],t);
 if([a.facingX,a.facingY,b.facingX,b.facingY].every(Number.isFinite)){
  const from=Math.atan2(a.facingX,a.facingY),to=Math.atan2(b.facingX,b.facingY),angle=from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;
  player.facingX=Math.sin(angle);player.facingY=Math.cos(angle);
 }
 return player;
}

/** Returns a fresh presentation state. It never steps physics or mutates frames. */
export function replayFrame(clip,elapsedMs){
 if(!clip?.frames?.length)return null;
 const frames=clip.frames,elapsed=Number.isFinite(elapsedMs)?clamp(elapsedMs,0,clip.durationMs):0,playDuration=clip.endMs-clip.startMs,time=clip.startMs+Math.min(elapsed,playDuration);
 let low=0,high=frames.length-1;
 while(low<high){const mid=Math.ceil((low+high)/2);if(frames[mid].time<=time)low=mid;else high=mid-1;}
 const a=frames[low],b=frames[Math.min(low+1,frames.length-1)],t=b.time>a.time?clamp((time-a.time)/(b.time-a.time),0,1):0;
 let state;
 if(t===1)state=structuredClone(b.state);
 else{
  state=structuredClone(a.state);
  if(t>0&&!b.cut){
   state.tick=lerp(a.state.tick,b.state.tick,t);
   for(const team of['home','away'])state[team]=a.state[team].map((p,i)=>b.state[team][i]?interpolatePlayer(p,b.state[team][i],t):structuredClone(p));
   for(const key of['x','y','z','vx','vy','vz','curl'])if(Number.isFinite(a.state.ball[key])&&Number.isFinite(b.state.ball[key]))state.ball[key]=lerp(a.state.ball[key],b.state.ball[key],t);
  }
 }
 state.replay=true;state.replayHold=elapsed>=playDuration;
 return state;
}
