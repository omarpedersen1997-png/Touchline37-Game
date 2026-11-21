import {createPlayerResponse} from './match-player-pose.js';
import{createFootballSwing}from'./football-swing.js';
import motion from'../assets/game/football-motion.json' with{type:'json'};
import * as THREE from 'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{clone as cloneSkeleton}from'three/addons/utils/SkeletonUtils.js';
import{sharePlayerSkeletons,mergePlayerClothing}from'./player-rendering.js';
import{configureMatchTextures}from'./match-textures.js';
import{createPlayerGrounding}from'./player-grounding.js';
import{isGoalCelebrant}from'./goal-presentation.js';
const detailUrl=typeof __PRO_PLAYER_URL__!=='undefined'?__PRO_PLAYER_URL__:null,autoUrl=typeof __PRO_PLAYER_AUTO_URL__!=='undefined'?__PRO_PLAYER_AUTO_URL__:detailUrl;
let template=null;const templates={},pending={};
const detailKey=quality=>quality==='sharp'||quality==='4k'?'detail':'auto';
export async function preloadFootballPlayers(quality='auto'){
 const key=detailKey(quality);if(templates[key])return templates[key];const url=key==='auto'?autoUrl:detailUrl;
 if(!url)throw Error('Spillermodellen mangler i denne appversion.');
 pending[key]||=new GLTFLoader().loadAsync(url).then(gltf=>{template=gltf.scene;template.updateMatrixWorld(true);templates[key]=template;return template;}).catch(error=>{delete pending[key];throw error;});return pending[key];
}
export function footballPlayerTemplate(quality='auto'){return templates[detailKey(quality)]||null;}
export function footballPlayersReady(){return !!template;}
export function createFootballPlayer({color='#c1f66b',number=1,shadow=false,keeper=false,kitMap=null,source=template,optimize=true,anisotropy=1}={}){
 if(!source)throw Error('Spillerne er ikke klar endnu.');
 const model=new THREE.Group(),human=cloneSkeleton(source),bones={},base=new Map(),parentRest=new Map(),sides={};model.add(human);human.updateMatrixWorld(true);
 human.traverse(o=>{if(o.isBone){bones[o.name]=o;base.set(o.name,o.quaternion.clone());parentRest.set(o.name,o.parent.getWorldQuaternion(new THREE.Quaternion()));sides[o.name]=Math.sign(o.getWorldPosition(new THREE.Vector3()).x)||1;}if(o.isMesh){o.frustumCulled=false;o.castShadow=shadow;o.receiveShadow=shadow;const source=Array.isArray(o.material)?o.material:[o.material];o.material=source.map(m=>{const material=m.clone();material.roughness=Math.max(.65,material.roughness||.8);if(/Football Shirt/i.test(m.name)){material.color.set(keeper?'#e5c254':color);if(kitMap){material.map=kitMap;material.color.set(0xffffff);}}if(/Football Shorts/i.test(m.name))material.color.set('#172733');if(/Football Socks/i.test(m.name))material.color.set(color);if(/Sneaker leather/i.test(m.name))material.color.set([0x15222b,0xe2e5df,0x9fca46,0xb73a39][number%4]);if(/Buzz cut/i.test(m.name))material.color.multiply(new THREE.Color([0xffffff,0x976643,0x4c3a31][number%3]));if(/Skin$/.test(m.name)){const tones=[0xffffff,0xd6b296,0xb08059,0xe3c5b0];material.color.multiply(new THREE.Color(tones[number%tones.length]));}return material;});if(!Array.isArray(o.material)||o.material.length===1)o.material=o.material[0];}});
 const grounding=createPlayerGrounding(human,source),paletteCount=optimize?sharePlayerSkeletons(human):null,savedDraws=optimize?mergePlayerClothing(human,source):0;
 const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=128;const c=labelCanvas.getContext('2d');c.fillStyle='rgba(10,27,38,.85)';c.fillRect(69,20,118,86);c.fillStyle='#f1f7ed';c.textAlign='center';c.font='bold 68px sans-serif';c.fillText(String(number),128,89);const labelMap=new THREE.CanvasTexture(labelCanvas);labelMap.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelMap,depthTest:false,sizeAttenuation:false}));label.scale.set(.038,.019,1);label.position.set(0,2.13,0);model.add(label);
 const back=document.createElement('canvas');back.width=192;back.height=256;const ink=back.getContext('2d');ink.textAlign='center';ink.font='bold 158px sans-serif';ink.strokeStyle='#15252e';ink.lineWidth=6;ink.fillStyle='#f4f7ec';ink.strokeText(String(number),96,196);ink.fillText(String(number),96,196);const backMap=new THREE.CanvasTexture(back);backMap.colorSpace=THREE.SRGBColorSpace;const jersey=new THREE.Mesh(new THREE.PlaneGeometry(.24,.3),new THREE.MeshBasicMaterial({map:backMap,transparent:true,depthWrite:false}));jersey.position.set(0,1.38,-.145);jersey.rotation.y=Math.PI;model.add(jersey);
 human.scale.y=1+(number%3-1)*.015;
 const swing=createFootballSwing(bones,base,parentRest);
 model.userData={response:createPlayerResponse(),professional:true,label,human,bones,base,swing,sides,paletteCount,savedDraws,grounding,motionTime:number*.137,motionClip:null,motionX:null,motionZ:null,motionBlend:0,motionFrom:Object.fromEntries(motion.bones.map(name=>[name,bones[name]?.quaternion.clone()])),motionRoot:0,poseA:new THREE.Quaternion(),poseB:new THREE.Quaternion(),jersey};
 configureMatchTextures(model,anisotropy);
 return model;
}
export function animateFootballPlayer(model,p,state,team,index,elapsed,visible=true,snap=false){
 const d=model.userData,speed=Math.hypot(p.vx,p.vy),kick=p.kick>0?Math.sin(Math.min(1,p.kick/12)*Math.PI):p.action==='kick'?Math.sin((1-p.actionTicks/Math.max(1,p.actionDuration))*Math.PI):0,celebrate=isGoalCelebrant(state,team,index,p);
 const clipName=celebrate?'cheer':speed>3.8?'run':speed>.25?'walk':'idle',clip=motion.clips[clipName];
 // A planted boot in the shipped capture travels at 3.50m/s (run) and
 // 1.42m/s (walk). The old 5.5m/s run reference made boots slide forwards.
 // Preserve the cycle phase at walk/run transitions and drive it from the
 // rendered body's actual displacement, including acceleration/deceleration.
 if(d.motionClip&&d.motionClip!==clipName){
  d.motionTime=d.motionTime/motion.clips[d.motionClip].duration*clip.duration;d.motionBlend=.12;d.motionRoot=d.bones.Hips?.position.y||0;
  for(const name of motion.bones)if(d.bones[name])d.motionFrom[name].copy(d.bones[name].quaternion);
 }
 const measured=d.motionX===null?NaN:Math.hypot(model.position.x-d.motionX,model.position.z-d.motionZ),expected=speed*elapsed;
 const tracked=Number.isFinite(p.x)&&Number.isFinite(p.y),distance=elapsed<=0?0:!snap&&Number.isFinite(measured)&&(tracked||measured>1e-6)&&measured<=Math.max(.35,expected*2.5)?measured:expected;
 d.motionX=model.position.x;d.motionZ=model.position.z;d.motionClip=clipName;
 d.motionTime+=celebrate||speed<=.25?elapsed:distance/(clipName==='run'?3.5:1.42);
 if(!visible)return;
 d.motionBlend=snap?0:Math.max(0,d.motionBlend-elapsed);
 const sample=(d.motionTime%clip.duration)/clip.duration*(clip.frames.length-1),frame=Math.floor(sample),mix=sample-frame,a=clip.frames[frame],b=clip.frames[Math.min(clip.frames.length-1,frame+1)],fade=1-d.motionBlend/.12,blend=fade*fade*(3-2*fade),qa=d.poseA,qb=d.poseB;
 // Smooth only clip changes. Continuously filtering every running pose shrank
 // the stride and made a correctly timed boot skate along the grass again.
 motion.bones.forEach((name,i)=>{const bone=d.bones[name];if(!bone)return;qa.fromArray(a.rot[i]);qb.fromArray(b.rot[i]);qa.slerp(qb,mix);if(d.motionBlend)bone.quaternion.copy(d.motionFrom[name]).slerp(qa,blend);else bone.quaternion.copy(qa);});
 const hips=d.bones.Hips;if(hips&&a.root&&b.root){const y=a.root[1]+(b.root[1]-a.root[1])*mix;hips.position.y=d.motionBlend?d.motionRoot+(y-d.motionRoot)*blend:y;}
 // Locomotion comes from captured human movement; football actions layer over it.
 if(kick>0){d.swing('RightUpLeg',-kick*.95);d.swing('RightLeg',kick*.48);d.swing('Spine2',kick*.08,-kick*.15);}
 model.position.y=0;
 if(p.dive>0){const progress=Math.min(1,Math.max(0,((p.actionDuration||16)-p.dive)/16));model.rotation.z=(p.diveX>=0?-1:1)*Math.sin(progress*Math.PI)*1.4;model.position.y=.18+Math.sin(progress*Math.PI)*.3;d.swing('LeftArm',-.8,0,(d.sides.LeftArm||1)*1.2);d.swing('RightArm',-.8,0,(d.sides.RightArm||-1)*1.2);}else if(p.tackle>0){model.rotation.x=.6;model.position.y=-.15;d.swing('RightUpLeg',-1.25);d.swing('RightLeg',.15);}else{model.rotation.z=0;model.rotation.x=0;}
 if(state.version===11&&state.engineRevision>=3){const response=d.response.update(p,elapsed,{snap,disabled:!!(p.dive>0||p.tackle>0||celebrate)});d.human.rotation.x=response.forward;d.human.rotation.z=-response.side;}
 if(!(p.dive>0)&&!(p.tackle>0))d.grounding.apply();else d.human.position.y=0;
 d.jersey.position.y=1.38;
 d.label.visible=team==='home'&&index===state.controlled;
}
