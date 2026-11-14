import{writeFileSync,readFileSync}from'node:fs';
import{nodeLibrary}from'./node-assets';
import{buildHuman}from'../src/core/human';
import{DEFAULT_PARAMS}from'../src/core/params';
import{Animator}from'../src/core/anim/evaluate';
import{clipById}from'../src/core/anim/clips';
const lib=await nodeLibrary(),params={...DEFAULT_PARAMS,...JSON.parse(readFileSync('../footballer-v2.params.json','utf8'))},ch=await buildHuman(lib,params),animator=new Animator(ch.rig!,ch.face);
const data:any={license:'MakeHuman CC0/Ara MIT/CMU mocap with NSF EIA-0196217 acknowledgement',bones:ch.rig!.bones.map(b=>b.name),clips:{}};
for(const id of['idle','walk','run','strafe_left','strafe_right','cheer']){const clip=clipById.get(id);if(!clip)continue;const b=animator.bake(clip,30,{rootMotion:false});data.clips[id]={duration:clip.duration,frames:b.frames.map(f=>({rot:f.rot.map(q=>q.map(v=>+v.toFixed(6))),root:[...f.rootPos.values()][0]?.map(v=>+v.toFixed(6))}))};}
writeFileSync('../touchline-motion.json',JSON.stringify(data));console.log(Object.fromEntries(Object.entries(data.clips).map(([k,v]:any)=>[k,v.frames.length])));
