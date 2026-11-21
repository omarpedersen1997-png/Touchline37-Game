import {MATCH_LIGHTING} from './match-lighting.js';
import {footballBodyProfile,keeperDivePose,createKeeperReadiness} from './football-body-profile.js';
import {matchAssetRoot} from './match-asset-config.js';
import {createAssetPlayerAnimation} from './asset-player-animation.js';
import {createLocomotionSelector} from './player-action-sample.js';
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
export async function preloadFootballPlayers(quality='auto',rich=!!matchAssetRoot){
 rich=!!(rich&&matchAssetRoot);
 const base=detailKey(quality);
 const load=async keeper=>{const key=(rich?'rich-':'')+(keeper?'keeper-':'')+base;if(templates[key])return templates[key];const url=rich?`${matchAssetRoot}/${keeper?'keeper':'player'}-${base==='detail'?'detail':'auto'}.glb`:base==='auto'?autoUrl:detailUrl;
 if(!url)throw Error('Spillermodellen mangler i denne appversion.');
 pending[key]||=new GLTFLoader().loadAsync(url).then(gltf=>{const source=gltf.scene;source.animations=gltf.animations;source.userData.richPack=rich;source.updateMatrixWorld(true);template=source;templates[key]=source;return source;}).catch(error=>{delete pending[key];throw error;});return pending[key];};
 const [source]=await Promise.all(rich?[load(false),load(true)]:[load(false)]);return source;
}
export function footballPlayerTemplate(quality='auto',keeper=false,rich=!!matchAssetRoot){rich=!!(rich&&matchAssetRoot);return templates[(rich?'rich-':'')+(keeper&&rich?'keeper-':'')+detailKey(quality)]||null;}
export function footballPlayersReady(){return !!template;}
export function createFootballPlayer({color='#c1f66b',number=1,shadow=false,keeper=false,kitMap=null,kitNormal=null,kitRoughness=null,bootMap=null,emblemMap=null,numberMap=null,source=template,optimize=true,anisotropy=1}={}){
 if(!source)throw Error('Spillerne er ikke klar endnu.');
 const richPack=!!source.userData.richPack;
 const model=new THREE.Group(),human=cloneSkeleton(source),bones={},base=new Map(),parentRest=new Map(),sides={};model.add(human);human.updateMatrixWorld(true);
 human.traverse(o=>{if(o.isBone){bones[o.name]=o;base.set(o.name,o.quaternion.clone());parentRest.set(o.name,o.parent.getWorldQuaternion(new THREE.Quaternion()));sides[o.name]=Math.sign(o.getWorldPosition(new THREE.Vector3()).x)||1;}if(o.isMesh){o.frustumCulled=false;o.castShadow=shadow;o.receiveShadow=shadow;const source=Array.isArray(o.material)?o.material:[o.material];o.material=source.map(m=>{const material=m.clone();material.roughness=Math.max(.65,material.roughness||.8);if(/Football Shirt/i.test(m.name)){material.color.set(richPack?color:keeper?'#e5c254':color);if(kitMap){material.map=kitMap;material.color.set(richPack?(keeper?'#e5c254':color):0xffffff);if(kitNormal){material.normalMap=kitNormal;material.normalScale.set(.25,.25);}if(kitRoughness)material.roughnessMap=kitRoughness;}}if(/Football Shorts/i.test(m.name))material.color.set('#172733');if(richPack&&/Football Shirt|Football Shorts/.test(m.name)){material.roughness=MATCH_LIGHTING.kitRoughness;if(kitMap)material.map=kitMap;if(kitNormal){material.normalMap=kitNormal;material.normalScale.set(.25,.25);}if(kitRoughness)material.roughnessMap=kitRoughness;}if(/Football Socks/i.test(m.name))material.color.set(color);if(/Sneaker leather/i.test(m.name)){material.color.set([0x354855,0xe2e5df,0x9fca46,0xb73a39][number%4]);if(bootMap){material.map=bootMap;material.roughness=.8;}}if(/Buzz cut/i.test(m.name))material.color.multiply(new THREE.Color([0xffffff,0x976643,0x4c3a31][number%3]));if(/Skin$/.test(m.name)){const tones=[0xffffff,0xd6b296,0xb08059,0xe3c5b0];material.color.multiply(new THREE.Color(tones[number%tones.length]));}return material;});if(!Array.isArray(o.material)||o.material.length===1)o.material=o.material[0];}});
 const grounding=createPlayerGrounding(human,source),paletteCount=optimize?sharePlayerSkeletons(human):null,savedDraws=optimize?mergePlayerClothing(human,source,richPack):0;
 const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=128;const c=labelCanvas.getContext('2d');c.fillStyle='rgba(10,27,38,.85)';c.fillRect(69,20,118,86);c.fillStyle='#f1f7ed';c.textAlign='center';c.font='bold 68px sans-serif';c.fillText(String(number),128,89);const labelMap=new THREE.CanvasTexture(labelCanvas);labelMap.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelMap,depthTest:false,sizeAttenuation:false}));label.scale.set(.038,.019,1);label.position.set(0,2.13,0);model.add(label);
 let backMap=numberMap;if(!backMap){const back=document.createElement('canvas');back.width=192;back.height=256;const ink=back.getContext('2d');ink.textAlign='center';ink.font='bold 158px sans-serif';ink.strokeStyle='#15252e';ink.lineWidth=6;ink.fillStyle='#f4f7ec';ink.strokeText(String(number),96,196);ink.fillText(String(number),96,196);backMap=new THREE.CanvasTexture(back);backMap.colorSpace=THREE.SRGBColorSpace;}const jersey=new THREE.Mesh(new THREE.PlaneGeometry(.24,.3),new THREE.MeshBasicMaterial({map:backMap,transparent:true,depthWrite:false}));jersey.position.set(0,1.38,-.145);jersey.rotation.y=Math.PI;model.add(jersey);if(numberMap){const uv=jersey.geometry.attributes.uv,col=(number-1)%4,row=Math.floor((number-1)/4);for(let i=0;i<uv.count;i++)uv.setXY(i,(col+uv.getX(i))/4,1-(row+1-uv.getY(i))/4);uv.needsUpdate=true;}
 if(richPack){
  const profile=footballBodyProfile(number,keeper);human.scale.set(profile.width,profile.height,profile.depth);
  // The printed number is part of the shirt: bind its rest transform to the
  // chest once, then the existing skeleton carries it through every action.
  human.updateMatrixWorld(true);model.updateMatrixWorld(true);
  if(bones.Spine2)bones.Spine2.attach(jersey);
 }else human.scale.y=1+(number%3-1)*.015;
 const swing=createFootballSwing(bones,base,parentRest);
 model.userData={locomotion:richPack?createLocomotionSelector():null,response:createPlayerResponse(),professional:true,label,human,bones,base,swing,sides,paletteCount,savedDraws,grounding,motionTime:number*.137,motionClip:null,motionX:null,motionZ:null,motionBlend:0,motionFrom:Object.fromEntries(motion.bones.map(name=>[name,bones[name]?.quaternion.clone()])),motionRoot:0,assetAnimation:source.userData.richPack?createAssetPlayerAnimation(source.animations,bones):null,poseA:new THREE.Quaternion(),poseB:new THREE.Quaternion(),jersey,divePose:{},richPack,keeperReadiness:richPack&&keeper?createKeeperReadiness():null};
 if(emblemMap){const badge=new THREE.Mesh(new THREE.PlaneGeometry(.09,.09),new THREE.MeshBasicMaterial({map:emblemMap,transparent:true,depthWrite:false}));badge.position.set(.095,1.44,.145);model.add(badge);if(richPack&&bones.Spine2){model.updateMatrixWorld(true);bones.Spine2.attach(badge);}}
 configureMatchTextures(model,anisotropy);
 return model;
}
export function animateFootballPlayer(model,p,state,team,index,elapsed,visible=true,snap=false,subtick=0){
 const d=model.userData,speed=Math.hypot(p.vx,p.vy),kick=p.kick>0?Math.sin(Math.min(1,p.kick/12)*Math.PI):p.action==='kick'?Math.sin((1-p.actionTicks/Math.max(1,p.actionDuration))*Math.PI):0,celebrate=isGoalCelebrant(state,team,index,p);
 const clipName=d.locomotion?d.locomotion(speed,celebrate):celebrate?'cheer':speed>3.8?'run':speed>.25?'walk':'idle',clip=motion.clips[clipName];
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
 d.motionTime+=celebrate||speed<=.25?elapsed:distance/((clipName==='run'?3.5:1.42)*(d.richPack?d.human.scale.z:1));
 if(!visible)return;
 d.motionBlend=snap?0:Math.max(0,d.motionBlend-elapsed);
 const sample=(d.motionTime%clip.duration)/clip.duration*(clip.frames.length-1),frame=Math.floor(sample),mix=sample-frame,a=clip.frames[frame],b=clip.frames[Math.min(clip.frames.length-1,frame+1)],fade=1-d.motionBlend/.12,blend=fade*fade*(3-2*fade),qa=d.poseA,qb=d.poseB;
 // Smooth only clip changes. Continuously filtering every running pose shrank
 // the stride and made a correctly timed boot skate along the grass again.
 if(!d.assetAnimation)motion.bones.forEach((name,i)=>{const bone=d.bones[name];if(!bone)return;qa.fromArray(a.rot[i]);qb.fromArray(b.rot[i]);qa.slerp(qb,mix);if(d.motionBlend)bone.quaternion.copy(d.motionFrom[name]).slerp(qa,blend);else bone.quaternion.copy(qa);});
 const hips=d.bones.Hips;if(hips&&a.root&&b.root){const y=a.root[1]+(b.root[1]-a.root[1])*mix;hips.position.y=d.motionBlend?d.motionRoot+(y-d.motionRoot)*blend:y;}
 // Locomotion comes from captured human movement; football actions layer over it.
 if(d.assetAnimation)d.assetAnimation.apply(clipName,d.motionTime,p,state,team,index,elapsed,model.rotation.y,snap,subtick);
 if(d.keeperReadiness){
  const ready=d.keeperReadiness.update(p,state,team,elapsed,{snap});
  if(ready>.001){
   d.swing('LeftUpLeg',-.18*ready,0,0,true);d.swing('RightUpLeg',-.18*ready,0,0,true);
   d.swing('LeftLeg',.34*ready,0,0,true);d.swing('RightLeg',.34*ready,0,0,true);
   d.swing('LeftArm',-.4*ready,0,0,true);d.swing('RightArm',-.4*ready,0,0,true);
  }
 }
 if(kick>0&&!d.assetAnimation){d.swing('RightUpLeg',-kick*.95);d.swing('RightLeg',kick*.48);d.swing('Spine2',kick*.08,-kick*.15);}
 if(d.assetAnimation&&p.action==='skill'&&p.actionTicks>0){const progress=Math.max(0,Math.min(1,1-(p.actionTicks-Math.max(0,Math.min(.045,subtick))/.05)/Math.max(1,p.actionDuration))),wave=Math.sin(progress*Math.PI);d.swing('RightUpLeg',-.28*wave,0,0,true);d.swing('RightLeg',.2*wave,0,0,true);d.swing('Spine2',0,.2*wave,0,true);}
 model.position.y=0;
 if(d.richPack){model.rotation.x=0;model.rotation.z=0;}
 if(d.richPack&&p.dive>0){
  const dive=keeperDivePose(p,model.rotation.y,state.replayHold||state.freeze>0?0:subtick,d.divePose);
  model.rotation.z=dive.roll;model.position.x+=dive.x;model.position.z+=dive.z;model.position.y=dive.height;
  // Both hands reach beyond the head into the save. The authored clip's
  // symmetric lateral arms otherwise turn into one up/one down after rolling.
  const ramp=Math.min(1,dive.progress/.18,(1-dive.progress)/.18),reach=Math.max(0,ramp*ramp*(3-2*ramp));
  for(const name of ['LeftArm','RightArm']){
   const arm=d.bones[name];if(!arm)continue;
   qa.copy(arm.quaternion);d.swing(name,-.25,0,(d.sides[name]||1)*2.7);
   arm.quaternion.copy(qa.slerp(arm.quaternion,reach)).normalize();
  }
 }else if(p.dive>0){const progress=Math.min(1,Math.max(0,((p.actionDuration||16)-p.dive)/16));model.rotation.z=(p.diveX>=0?-1:1)*Math.sin(progress*Math.PI)*1.4;model.position.y=.18+Math.sin(progress*Math.PI)*.3;d.swing('LeftArm',-.8,0,(d.sides.LeftArm||1)*1.2);d.swing('RightArm',-.8,0,(d.sides.RightArm||-1)*1.2);}else if(p.tackle>0){model.rotation.x=.6;model.position.y=-.15;d.swing('RightUpLeg',-1.25);d.swing('RightLeg',.15);}else{model.rotation.z=0;model.rotation.x=0;}
 if(state.version===11&&state.engineRevision>=3){const response=d.response.update(p,elapsed,{snap,disabled:!!(p.dive>0||p.tackle>0||celebrate)});d.human.rotation.x=response.forward;d.human.rotation.z=-response.side;}
 if(!(p.dive>0)&&!(p.tackle>0))d.grounding.apply();else d.human.position.y=0;
 if(!d.richPack)d.jersey.position.y=1.38;
 d.label.visible=team==='home'&&index===state.controlled;
}
