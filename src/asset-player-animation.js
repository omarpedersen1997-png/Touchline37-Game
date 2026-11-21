// Actual glTF skeletal tracks. Interpolants and transition poses are allocated
// once per player; no AnimationMixer/property binding work in the render loop.
import {Quaternion} from 'three';
import {sampleFootballAction} from './player-action-sample.js';
export function createAssetPlayerAnimation(clips,bones){
 if(!clips?.length)return null;
 const samples=new Map(clips.map(clip=>[clip.name,{duration:clip.duration,tracks:clip.tracks.map(track=>({bone:bones[track.name.slice(0,track.name.lastIndexOf('.'))],rotation:track.name.endsWith('.quaternion'),interpolant:track.createInterpolant()})).filter(t=>t.bone)}]));
 const turnTracks=(samples.get('turn')?.tracks||[]).filter(t=>t.rotation&&['Spine2','LeftShoulder','RightShoulder'].includes(t.bone.name)).map(t=>({...t,rest:new Quaternion().fromArray(t.interpolant.evaluate(0)).invert()})),delta=new Quaternion(),identity=new Quaternion();let turnWeight=0;
 const from=Object.fromEntries(Object.entries(bones).map(([key,bone])=>[key,bone.quaternion.clone()])),target=new Quaternion(),actionSample={};let previous='',blend=0,transition=.075,heading=null,sprinting=false;
 return {apply(base,time,p,state,team,index,dt,renderedHeading,snap=false,subtick=0){
  let name=base,phase=time;
  const speed=Math.hypot(p.vx,p.vy);sprinting=base==='run'&&(sprinting?speed>6.8:speed>7.4);
  if(sprinting){name='sprint';phase*=.82;}
  sampleFootballAction(p,state,team,index,name,phase,actionSample,subtick);name=actionSample.clip;phase=actionSample.time;
  const nextHeading=Number.isFinite(renderedHeading)?renderedHeading:Math.atan2(p.facingX,p.facingY),angle=heading===null||snap?0:Math.atan2(Math.sin(nextHeading-heading),Math.cos(nextHeading-heading)),rate=dt>0?angle/dt:0;
  const turnTarget=speed>1&&!actionSample.action?Math.max(-1,Math.min(1,rate/4.5)):0;
  if(snap)turnWeight=0;else turnWeight+=(turnTarget-turnWeight)*(1-Math.exp(-18*Math.min(.1,Math.max(0,dt))));
  heading=nextHeading;
  const clip=samples.get(name)||samples.get(base);if(!clip)return;
  if(previous!==name){for(const key in bones)from[key].copy(bones[key].quaternion);const sameStride=(previous==='run'||previous==='sprint')&&(name==='run'||name==='sprint');transition=actionSample.action ? .04 : .075;blend=sameStride||snap?0:transition;previous=name;}
  blend=Math.max(0,blend-Math.max(0,Math.min(.1,dt)));const alpha=1-blend/transition,t=((phase%clip.duration)+clip.duration)%clip.duration;
  for(const track of clip.tracks){const value=track.interpolant.evaluate(t);if(track.rotation){target.fromArray(value).normalize();track.bone.quaternion.copy(from[track.bone.name]).slerp(target,alpha);}else track.bone.position.fromArray(value);}
  // Keep the running legs planted while the authored upper-body turn layers on.
  if(Math.abs(turnWeight)>.001){const t=samples.get('turn').duration*.5;for(const track of turnTracks){target.fromArray(track.interpolant.evaluate(t)).normalize();delta.copy(track.rest).multiply(target);if(turnWeight<0)delta.invert();delta.slerp(identity,1-Math.abs(turnWeight));track.bone.quaternion.multiply(delta).normalize();}}
 },get clip(){return previous;}};
}
