import{createMatchFramePacer}from'./match-frame-pacer.js';
import{replayFrame}from'./goal-replay.js';
// Sample/clone a replay only when a frame will actually be submitted. Fast
// screens otherwise create and discard a full player state between draws.
export function createReplayPlayback(clip,{targetFps=30,sample=replayFrame}={}){
 const due=createMatchFramePacer(targetFps);let origin=null,finished=false;
 return now=>{
  if(finished)return{state:null,complete:true};
  if(!Number.isFinite(now))return{state:null,complete:false};
  if(origin===null)origin=now;
  const elapsed=Math.max(0,Math.min(clip.durationMs,now-origin)),complete=elapsed>=clip.durationMs;
  const state=due(now,complete)?sample(clip,elapsed):null;
  if(complete)finished=true;
  return{state,complete};
 };
}
