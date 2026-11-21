// Actual glTF skeletal tracks. Interpolants and transition poses are allocated
// once per player; no AnimationMixer/property binding work in the render loop.
import {Quaternion} from 'three';
export function createAssetPlayerAnimation(clips,bones){
 if(!clips?.length)return null;
 const samples=new Map(clips.map(clip=>[clip.name,{duration:clip.duration,tracks:clip.tracks.map(track=>({bone:bones[track.name.slice(0,track.name.lastIndexOf('.'))],rotation:track.name.endsWith('.quaternion'),interpolant:track.createInterpolant()})).filter(t=>t.bone)}]));
 const turnTracks=(samples.get('turn')?.tracks||[]).filter(t=>t.rotation&&['Spine2','LeftShoulder','RightShoulder'].includes(t.bone.name)).map(t=>({...t,rest:new Quaternion().fromArray(t.interpolant.evaluate(0)).invert()})),delta=new Quaternion(),identity=new Quaternion();let turnWeight=0;
 const from=Object.fromEntries(Object.entries(bones).map(([key,bone])=>[key,bone.quaternion.clone()])),target=new Quaternion();let previous='',blend=0,heading=null;
 return {apply(base,time,p,state,team,index,dt){
  let name=base,phase=time;
  if(base==='run'&&Math.hypot(p.vx,p.vy)>7.2){name='sprint';phase*=.82;}
  const action=state.lastAction,own=action?.team===team&&action?.index===index;
  if(p.dive>0){name='dive';phase=(1-Math.min(1,p.dive/16))*.85;}
  else if(p.tackle>0){name='tackle';phase=(1-Math.min(1,p.tackle/16))*.8;}
  else if(p.kick>0&&own){name=action.kind==='shot'?'shoot':'pass';phase=(1-Math.min(1,p.kick/12))*(name==='shoot'?.7:.55);}
  const turning=heading!==null&&Math.abs(Math.atan2(Math.sin(Math.atan2(p.facingX,p.facingY)-heading),Math.cos(Math.atan2(p.facingX,p.facingY)-heading)))>.04&&Math.hypot(p.vx,p.vy)>1&&!p.kick&&!p.dive&&!p.tackle;
  turnWeight+=((turning?1:0)-turnWeight)*(1-Math.exp(-18*Math.min(.1,Math.max(0,dt))));
  heading=Math.atan2(p.facingX,p.facingY);
  const clip=samples.get(name)||samples.get(base);if(!clip)return;
  if(previous!==name){for(const key in bones)from[key].copy(bones[key].quaternion);blend=.09;previous=name;}
  blend=Math.max(0,blend-Math.max(0,Math.min(.1,dt)));const alpha=1-blend/.09,t=((phase%clip.duration)+clip.duration)%clip.duration;
  for(const track of clip.tracks){const value=track.interpolant.evaluate(t);if(track.rotation){target.fromArray(value);track.bone.quaternion.copy(from[track.bone.name]).slerp(target,alpha);}else track.bone.position.fromArray(value);}
  // Keep the running legs planted while the authored upper-body turn layers on.
  if(turnWeight>.001){const t=time%samples.get('turn').duration;for(const track of turnTracks){target.fromArray(track.interpolant.evaluate(t));delta.copy(track.rest).multiply(target);delta.slerp(identity,1-turnWeight);track.bone.quaternion.multiply(delta);}}
 },get clip(){return previous;}};
}
