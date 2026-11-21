import{createMatchFramePacer}from'./match-frame-pacer.js';
import{replayFrame}from'./goal-replay.js';
// Sample/clone a replay only when a frame will actually be submitted. Fast
// screens otherwise create and discard a full player state between draws.
export function createReplayPlayback(clip,{targetFps=30,sample=replayFrame}={}){
 const due=createMatchFramePacer(targetFps);let previous=null,elapsed=0,finished=false,paused=false,speed=1,changed=false;
 const play=now=>{
  if(finished)return{state:null,complete:true};
  if(!Number.isFinite(now))return{state:null,complete:false};
  if(previous!==null&&!paused)elapsed=Math.min(clip.durationMs,elapsed+Math.max(0,now-previous)*speed);
  previous=now;const complete=elapsed>=clip.durationMs;
  const state=(!paused||changed||complete)&&due(now,changed||complete)?sample(clip,elapsed):null;changed=false;
  if(complete)finished=true;
  return{state,complete};
 };
 play.setPaused=(value,now)=>{if(Number.isFinite(now))play(now);paused=!!value;changed=true;};
 play.setSpeed=(value,now)=>{if(![.5,1,2].includes(value))return;if(Number.isFinite(now))play(now);speed=value;changed=true;};
 return play;
}
