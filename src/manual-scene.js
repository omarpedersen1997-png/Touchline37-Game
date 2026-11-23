import {createMatch2DPlayers} from './match-2d-players.js';
import {createDistancePlayers,keepDetailedPlayer} from './match-distance-players.js';
import { applyFastMatchMaterials, takeMatchPose, usesFastMatchRender } from './match-fast-render.js';
import {r4PoseFrame,sampleR4Player,sampleR4Ball} from '../shared/football-pose-r4.js';
import {createR4CameraPlan} from './broadcast-r4.js';
import {createFocusMarker} from './focus-marker.js';
import {createBroadcastChalk} from './broadcast-chalk.js';
import {createBroadcastPitch} from './broadcast-pitch.js';
import {createBroadcastShadows} from './broadcast-shadows.js';
import {MATCH_LIGHTING} from './match-lighting.js';
import {ballSurfacePose,playerContactShadow} from './match-ball-surface.js';
import {preloadRichMatchAssets,richMatchAssets,buildRichStadium,buildRichGoals,cloneRichPart,texturedKit} from './rich-match-assets.js';
import {createBallTrail} from './ball-trail.js';
import {samplePlayerPose} from './match-player-pose.js';
import {createBallRoll} from './ball-roll.js';
import {createLivingCameraRig} from './living-camera.js';
import{createMatchViewport}from'./match-viewport.js';
import{motionBlend,detailPlayer,ballSpinStep}from'./match-presentation.js';
import{preloadFootballPlayers,footballPlayerTemplate,createFootballPlayer,animateFootballPlayer}from'./pro-player.js';
import{getArcadeRules}from'../shared/arcade.js';
import{buildProStadium}from'./pro-stadium.js';
import{matchResolution,createAutoResolutionController}from'./match-quality.js';
import{passTarget as assistedPass}from'../shared/football-modern.js';
import * as THREE from 'three';
import{stadiumLayout}from'./stadium-layout.js';
import{matchCamera}from'./match-camera.js';
import{visibleBallDiameter}from'./match-ball-visibility.js';
import{updateMatchWorld,playerInFrame,copyPlayerPose}from'./player-rendering.js';
import{configureMatchTextures}from'./match-textures.js';
import{matchRenderBudget}from'./match-render-budget.js';
import{contactShadowTexture}from'./contact-shadow.js';
import{buildPitchDetails}from'./pitch-details.js';
import{createMatchFrameStats}from'./match-frame-stats.js';
import{safeMatchPrediction}from'./match-prediction.js';
import{matchTickPhase,createDetailWarmQueue}from'./match-scheduling.js';
import{createShaderWarmup}from'./shader-warmup.js';
import{isGoalCelebrant,goalCameraPlan,goalBallPosition,deformGoalNet}from'./goal-presentation.js';
const away='#397bca';
function groundLines(scene,field,professional=false,spatialR3=false){
 const w=field.width/2,l=field.length/2,penaltyW=Math.min(20,w*.63),penaltyD=Math.min(16.5,l*.32),goalW=field.goalWidth/2;
 const vertices=[],solid=[],chalkEdges=[];const line=(x,z,xx,zz)=>{vertices.push(x,.045,z,xx,.045,zz);if(professional){const dx=xx-x,dz=zz-z,d=Math.hypot(dx,dz)||1,px=-dz/d*(spatialR3?.3:.06),pz=dx/d*(spatialR3?.3:.06);for(const p of[[x+px,z+pz],[xx+px,zz+pz],[xx-px,zz-pz],[x+px,z+pz],[xx-px,zz-pz],[x-px,z-pz]])solid.push(p[0],.052,p[1]);if(spatialR3)chalkEdges.push(1,1,-1,1,-1,-1);}};
 [[-w,-l,w,-l],[w,-l,w,l],[w,l,-w,l],[-w,l,-w,-l],[-w,0,w,0]].forEach(p=>line(...p));
 for(const end of[-1,1])for(const[wide,deep]of[[penaltyW,penaltyD],[goalW+4,5.5]]){line(-wide,end*l,-wide,end*(l-deep));line(-wide,end*(l-deep),wide,end*(l-deep));line(wide,end*(l-deep),wide,end*l);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));if(!professional)scene.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xd9f2d6,transparent:true,opacity:.82})));else{geometry.dispose();const markings=new THREE.BufferGeometry();markings.setAttribute('position',new THREE.Float32BufferAttribute(solid,3));const chalk=spatialR3?createBroadcastChalk():new THREE.MeshBasicMaterial({color:0xeff3df,side:THREE.DoubleSide});
  if(spatialR3)markings.setAttribute('chalkEdge',new THREE.Float32BufferAttribute(chalkEdges,1));
  const lines=new THREE.Mesh(markings,chalk);if(spatialR3)lines.renderOrder=1;scene.add(lines);
  const ringGeometry=new THREE.RingGeometry(spatialR3?8.85:9.09,spatialR3?9.45:9.21,spatialR3?128:80);
  if(spatialR3){const p=ringGeometry.attributes.position,edge=new Float32Array(p.count);for(let i=0;i<p.count;i++)edge[i]=(Math.hypot(p.getX(i),p.getY(i))-9.15)/.3;ringGeometry.setAttribute('chalkEdge',new THREE.BufferAttribute(edge,1));}
  const ring=new THREE.Mesh(ringGeometry,chalk);ring.rotation.x=-Math.PI/2;ring.position.y=.052;if(spatialR3)ring.renderOrder=1;scene.add(ring);}
 const circle=new THREE.BufferGeometry().setFromPoints(Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2)*field.width*.135,.046,Math.sin(i/64*Math.PI*2)*field.width*.135)));if(!professional)scene.add(new THREE.Line(circle,new THREE.LineBasicMaterial({color:0xd9f2d6,transparent:true,opacity:.8})));else circle.dispose();
}
function labelSprite(text){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='rgba(15,38,28,.82)';c.fillRect(28,8,72,48);c.fillStyle='#f0f8e6';c.font='bold 34px sans-serif';c.textAlign='center';c.fillText(text,64,45);
 const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,sizeAttenuation:false,transparent:true}));sprite.scale.set(.045,.0225,1);sprite.position.y=2.65;return sprite;
}
export function buildMatchPlayer(color,number,shadow,kit={}){
 const g=new THREE.Group(),shirt=new THREE.MeshStandardMaterial({color:kit.map?0xffffff:color,map:kit.map||null,roughness:.92}),shorts=new THREE.MeshStandardMaterial({color:0x142b33,roughness:.95}),socks=new THREE.MeshStandardMaterial({color:0xe8ede2}),boots=new THREE.MeshStandardMaterial({color:0x17262d}),skin=new THREE.MeshStandardMaterial({color:[0xbf8667,0x875741,0xe3b899,0xa47052][number%4],roughness:.9});
 const add=(geo,mat,x,y,z,parent=g)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=shadow;parent.add(m);return m;};
 const torso=add(new THREE.CapsuleGeometry(.27,.37,4,10),shirt,0,1.35,0);torso.scale.set(1.25,1,.72);
 add(new THREE.CylinderGeometry(.31,.26,.28,10),shorts,0,.96,0);
 add(new THREE.CylinderGeometry(.1,.12,.16,9),skin,0,1.78,0);
 const head=add(new THREE.SphereGeometry(.17,20,14),skin,0,2.01,0);head.scale.set(.88,1.14,.92);
 const hair=add(new THREE.SphereGeometry(.174,18,10,0,Math.PI*2,0,Math.PI*.58),boots,0,2.045,-.012);hair.scale.set(.94,1,.96);
 const collar=add(new THREE.TorusGeometry(.12,.025,5,14),shorts,0,1.765,.005);collar.rotation.x=Math.PI/2;
 for(const x of[-.052,.052])add(new THREE.SphereGeometry(.014,6,5),boots,x,2.026,.144);
 add(new THREE.ConeGeometry(.026,.065,6),skin,0,1.99,.166).rotation.x=Math.PI/2;
 const legs=[],knees=[],arms=[],elbows=[];
 for(const sign of[-1,1]){
  const leg=new THREE.Group();leg.position.set(sign*.16,.96,0);g.add(leg);legs.push(leg);
  add(new THREE.CylinderGeometry(.115,.09,.36,8),skin,0,-.19,0,leg);
  const knee=new THREE.Group();knee.position.y=-.38;leg.add(knee);knees.push(knee);
  add(new THREE.CylinderGeometry(.09,.072,.34,8),socks,0,-.18,0,knee);add(new THREE.BoxGeometry(.2,.13,.36),boots,0,-.4,.07,knee);
  const arm=new THREE.Group();arm.position.set(sign*.36,1.61,0);g.add(arm);arms.push(arm);
  add(new THREE.CylinderGeometry(.105,.085,.22,8),shirt,sign*.025,-.09,0,arm);add(new THREE.CylinderGeometry(.075,.064,.18,7),skin,sign*.04,-.26,0,arm);
  const elbow=new THREE.Group();elbow.position.set(sign*.04,-.34,0);arm.add(elbow);elbow.rotation.x=-.35;elbows.push(elbow);add(new THREE.CylinderGeometry(.065,.05,.25,7),skin,0,-.135,0,elbow);add(new THREE.SphereGeometry(.067,6,5),skin,0,-.28,0,elbow);arm.rotation.z=sign*.13;
 }
 const back=document.createElement('canvas');back.width=96;back.height=128;const ink=back.getContext('2d');ink.font='bold 82px sans-serif';ink.textAlign='center';ink.strokeStyle='#163028';ink.lineWidth=3;ink.fillStyle='#f0f4df';ink.strokeText(String(number),48,97);ink.fillText(String(number),48,97);const backTexture=new THREE.CanvasTexture(back),jerseyNumber=new THREE.Mesh(new THREE.PlaneGeometry(.34,.43),new THREE.MeshBasicMaterial({map:backTexture,transparent:true,depthWrite:false}));jerseyNumber.position.set(0,1.36,-.21);jerseyNumber.rotation.y=Math.PI;g.add(jerseyNumber);
 const label=labelSprite(String(number));g.add(label);g.userData={legs,knees,arms,elbows,label,hair,torso};return g;
}
const awayKits=new Map();
export function opponentKitColor(home){const key=typeof home==='string'?home.toLowerCase():'#c1f66b';if(!awayKits.has(key)){const color=new THREE.Color(key),hsl={};color.getHSL(hsl);awayKits.set(key,hsl.h>.44&&hsl.h<.76?'#c94058':away);}return awayKits.get(key);}
function kitTexture(color,pattern='classic'){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');c.scale(2,2);c.fillStyle=color;c.fillRect(0,0,256,256);c.fillStyle='#153a32';c.globalAlpha=.75;
 if(pattern==='stripe')for(let x=0;x<256;x+=64)c.fillRect(x,0,25,256);
 if(pattern==='hoop')for(let y=0;y<256;y+=56)c.fillRect(0,y,256,20);
 c.globalAlpha=.07;c.fillStyle='#fff';for(let y=0;y<256;y+=4)c.fillRect(0,y,256,1);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
// Keep the animated hierarchy on the CPU; batch equal visible parts on the GPU.
// Unique number textures/sprites stay independent and readable.
export function batchMatchPlayers(scene,models,shadow=false,sharedMaps=[]){
 const groups=new Map();for(const model of Object.values(models).flat())model.traverse(mesh=>{if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.material.map&&!sharedMaps.includes(mesh.material.map))return;const m=mesh.material,key=mesh.geometry.type+JSON.stringify(mesh.geometry.parameters)+m.color.getHex()+':'+m.roughness+':'+(m.map?.uuid||'');if(!groups.has(key))groups.set(key,{geometry:mesh.geometry,material:m,parts:[]});groups.get(key).parts.push(mesh);mesh.visible=false;});
 const batches=[...groups.values()].map(g=>{const mesh=new THREE.InstancedMesh(g.geometry,g.material,g.parts.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=shadow;mesh.frustumCulled=false;scene.add(mesh);return{mesh,parts:g.parts};});
 return{batches,update(){scene.updateMatrixWorld(true);for(const {mesh,parts}of batches){parts.forEach((part,i)=>mesh.setMatrixAt(i,part.matrixWorld));mesh.instanceMatrix.needsUpdate=true;}}};
}
// Original procedural football: smooth panels, black pentagons and fine seams.
export function buildMatchBall(shadow=false){
 const radius=.19,source=new THREE.IcosahedronGeometry(1,0),raw=source.attributes.position,vertices=[],faces=[],byKey=new Map();
 for(let i=0;i<raw.count;i+=3){const face=[];for(let j=0;j<3;j++){const v=new THREE.Vector3().fromBufferAttribute(raw,i+j).normalize(),key=v.toArray().map(n=>n.toFixed(6)).join(',');if(!byKey.has(key)){byKey.set(key,vertices.length);vertices.push(v);}face.push(byKey.get(key));}faces.push(face);}source.dispose();
 const neighbours=vertices.map(()=>new Set()),positions=[],colors=[],white=new THREE.Color(0xf2f3ed),black=new THREE.Color(0x16222a);
 const addPanel=(points,color)=>{let center=points.reduce((v,p)=>v.add(p),new THREE.Vector3()).divideScalar(points.length).normalize();const axis=new THREE.Vector3(0,1,0);if(Math.abs(center.y)>.95)axis.set(1,0,0);const u=new THREE.Vector3().crossVectors(axis,center).normalize(),v=new THREE.Vector3().crossVectors(center,u);points.sort((a,b)=>Math.atan2(a.dot(v),a.dot(u))-Math.atan2(b.dot(v),b.dot(u)));const rim=points.map(p=>p.clone().lerp(center,.045).normalize().multiplyScalar(radius)),c=center.clone().multiplyScalar(radius);for(let i=0;i<rim.length;i++)for(const point of[c,rim[i],rim[(i+1)%rim.length]]){positions.push(...point.toArray());colors.push(color.r,color.g,color.b);}};
 for(const[a,b,c]of faces){for(const[i,j]of[[a,b],[b,c],[c,a]]){neighbours[i].add(j);neighbours[j].add(i);}addPanel([[a,b],[b,a],[b,c],[c,b],[c,a],[a,c]].map(([i,j])=>vertices[i].clone().lerp(vertices[j],1/3).normalize()),white);}
 vertices.forEach((v,i)=>addPanel([...neighbours[i]].map(j=>v.clone().lerp(vertices[j],1/3).normalize()),black));
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(positions.map(n=>n/radius),3));geometry.computeBoundingSphere();
 const g=new THREE.Group(),panels=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7})),seams=new THREE.Mesh(new THREE.SphereGeometry(radius*.94,20,12),new THREE.MeshStandardMaterial({color:0x52605b,roughness:.85}));panels.castShadow=shadow;g.add(seams,panels);return g;
}
function grassTexture(){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=9127;
 for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const shade=210+(seed%40);pixels.data[i]=shade;pixels.data[i+1]=shade;pixels.data[i+2]=shade;pixels.data[i+3]=255;}
 ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(12,3);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function professionalGrass(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,512);let seed=81731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<pixels.data.length;i+=4){const n=(random()-.5)*25;pixels.data[i]=98+n;pixels.data[i+1]=132+n;pixels.data[i+2]=68+n*.7;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);ctx.lineWidth=.75;
 for(let i=0;i<18000;i++){const x=random()*512,y=random()*512;ctx.strokeStyle=i%2?'rgba(189,207,138,.23)':'rgba(33,76,23,.22)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*4,y-2-random()*6);ctx.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(16,4);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function buildMatchStadium(scene,field,stage=2){
 const layout=stadiumLayout(stage,field),materials={base:new THREE.MeshStandardMaterial({color:0x203f30,roughness:1}),walkway:new THREE.MeshStandardMaterial({color:0x4c6650,roughness:1}),seating:new THREE.MeshStandardMaterial({color:0x597f58,roughness:1}),roof:new THREE.MeshStandardMaterial({color:0x8ca897,roughness:.85}),post:new THREE.MeshStandardMaterial({color:0x6e8c77,roughness:.8})};
 const seating=[];
 for(const b of layout.boxes){const mesh=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.h,b.d),materials[b.kind]);mesh.position.set(b.x,b.y,b.z);mesh.receiveShadow=true;scene.add(mesh);if(b.kind==='seating')seating.push(b);}
 // One draw call for the crowd rather than thousands of separate meshes.
 const seats=[];for(const b of seating){if(b.d>b.w){for(let z=-b.d/2+1;z<b.d/2;z+=1.7)seats.push([b.x,b.y+b.h/2+.3,z]);}else for(let x=-b.w/2+1;x<b.w/2;x+=1.7)seats.push([x,b.y+b.h/2+.3,b.z]);}
 const crowd=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.14,.22,2,5),new THREE.MeshStandardMaterial({color:0xa5bb89,roughness:1}),seats.length),matrix=new THREE.Matrix4();
 seats.forEach(([x,y,z],i)=>{matrix.makeTranslation(x,y,z);crowd.setMatrixAt(i,matrix);crowd.setColorAt(i,new THREE.Color([0x9db886,0x304d3c,0xd4dcb8,0x6d8f70,0xc1dd8c][i%5]));});scene.add(crowd);const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.13,6,4),new THREE.MeshStandardMaterial({color:0xc89b79,roughness:1}),seats.length);seats.forEach(([x,y,z],i)=>{matrix.makeTranslation(x,y+.34,z);heads.setMatrixAt(i,matrix);heads.setColorAt(i,new THREE.Color([0xc89b79,0x88634e,0xe1bd9e][i%3]));});scene.add(heads);
 const lamp=new THREE.MeshBasicMaterial({color:0xedffd1});
 for(const p of layout.poles){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,p.height,6),materials.post);pole.position.set(p.x,p.height/2,p.z);scene.add(pole);const light=new THREE.Mesh(new THREE.BoxGeometry(3,.8,.4),lamp);light.position.set(p.x,p.height,p.z);scene.add(light);}
 const nets=buildMatchGoals(scene,field);
 return{layout,nets,crowd};
}
export function buildMatchGoals(scene,field){
 const nets=[];
 for(const sign of[-1,1]){
  const w=field.goalWidth/2,l=field.length/2,h=field.goalHeight,posts=new THREE.MeshStandardMaterial({color:0xf3f6e9});
  for(const x of[-w,w]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,h,6),posts);post.position.set(x,h/2,sign*l);scene.add(post);}
  const crossbar=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,w*2,6),posts);crossbar.rotation.z=Math.PI/2;crossbar.position.set(0,h,sign*l);scene.add(crossbar);
  const points=[],segment=(x,y,z,xx,yy,zz)=>points.push(x,y,z,xx,yy,zz);
  for(let x=-w;x<=w+.01;x+=.5){segment(x,0,sign*(l+2),x,h,sign*(l+2));segment(x,h,sign*l,x,h,sign*(l+2));}
  for(let y=0;y<=h+.01;y+=.4){segment(-w,y,sign*(l+2),w,y,sign*(l+2));for(const x of[-w,w])segment(x,y,sign*l,x,y,sign*(l+2));}
  for(let z=l;z<=l+2;z+=.5){segment(-w,h,sign*z,w,h,sign*z);for(const x of[-w,w])segment(x,0,sign*z,x,h,sign*z);}
  const net=new THREE.BufferGeometry();net.setAttribute('position',new THREE.Float32BufferAttribute(points,3));net.translate(0,0,-sign*l);const mesh=new THREE.LineSegments(net,new THREE.LineBasicMaterial({color:0xc6d6c6,transparent:true,opacity:.52}));mesh.position.z=sign*l;mesh.userData.netSign=sign;mesh.userData.restNet=net.attributes.position.array.slice();mesh.userData.netDeformed=false;scene.add(mesh);nets.push(mesh);
 }
 return nets;
}
function webglScene(container,options){
 const cameraRig=createLivingCameraRig(),motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const fast=usesFastMatchRender(options.version,options.initialState?.engineRevision,options.quality);
 const assetPack=options.version===11&&options.initialState?.engineRevision>=3?richMatchAssets(options.quality,fast):null;
 const spatialR3=options.version===11&&options.initialState?.engineRevision>=3;
 const r4Lighting=options.initialState?.engineRevision>=4;
 const broadcastR4=createR4CameraPlan(),r4Ball={},r4Player={};
 const professional=options.version>=5,budget=matchRenderBudget(options.version,options.quality);
 const field=options.field||{width:40,length:64,goalWidth:8,goalHeight:2.4},count=options.players||5;
 const renderer=new THREE.WebGLRenderer({antialias:budget.antialias,alpha:false,powerPreference:budget.powerPreference});let observer,shaderWarmup;try{renderer.setPixelRatio(1);renderer.localClippingEnabled=professional;renderer.shadowMap.enabled=budget.liveShadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=spatialR3?MATCH_LIGHTING.exposure:professional?1.02:1.12;renderer.setClearColor(spatialR3?MATCH_LIGHTING.background:professional?0x9db7c6:0x172833);container.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(spatialR3?MATCH_LIGHTING.background:professional?0x9db7c6:0x172833,spatialR3?MATCH_LIGHTING.fogNear:professional?240:200,spatialR3?MATCH_LIGHTING.fogFar:professional?600:360);scene.add(new THREE.HemisphereLight(professional?0xe5f0fb:0xe4f3db,professional?0x485137:0x203c28,professional?1.8:2));const light=new THREE.DirectionalLight(0xfff2d6,2.2);light.position.set(-25,55,20);light.castShadow=renderer.shadowMap.enabled;light.shadow.mapSize.set(2048,2048);light.shadow.normalBias=.025;light.shadow.bias=-.0002;light.shadow.radius=3;light.shadow.camera.left=-45;light.shadow.camera.right=45;light.shadow.camera.top=65;light.shadow.camera.bottom=-65;light.shadow.camera.far=160;scene.add(light);
 if(spatialR3){
  const fill=scene.children.find(node=>node.isHemisphereLight);fill.color.setHex(MATCH_LIGHTING.sky);fill.groundColor.setHex(MATCH_LIGHTING.ground);fill.intensity=MATCH_LIGHTING.ambient*(r4Lighting?.84:1);
  light.color.setHex(MATCH_LIGHTING.key);light.intensity=MATCH_LIGHTING.keyIntensity*(r4Lighting?1.13:1);
  if(r4Lighting)light.position.set(-24,35,25);
  const rim=new THREE.DirectionalLight(MATCH_LIGHTING.rim,MATCH_LIGHTING.rimIntensity*(r4Lighting?1.12:1));rim.position.set(30,24,-35);scene.add(rim);
 }
 const stadium=professional?{...(assetPack?buildRichStadium(scene,field,options.quality,assetPack,fast):buildProStadium(scene,field,options.quality)),nets:assetPack?buildRichGoals(scene,field,assetPack):buildMatchGoals(scene,field),layout:{pitchY:.03}}:buildMatchStadium(scene,field,options.stage??2),{nets,layout}=stadium,grass=assetPack?assetPack.textures[`grass-color-${assetPack.size}.png`]:professional?professionalGrass():grassTexture();grass.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 if(spatialR3&&assetPack)scene.add(createBroadcastPitch(field,{color:grass,normal:assetPack.textures[`grass-normal-${assetPack.size}.png`],roughness:assetPack.textures[`grass-roughness-${assetPack.size}.png`]}));
 else for(let i=0;i<12;i++){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(field.width,field.length/12),new THREE.MeshStandardMaterial({color:spatialR3?(i%2?MATCH_LIGHTING.pitchLight:MATCH_LIGHTING.pitchDark):professional?(i%2?0x89ad65:0x7e9f5f):(i%2?0x549b4d:0x43873f),roughness:1,map:grass,normalMap:assetPack?.textures[`grass-normal-${assetPack.size}.png`]||null,normalScale:new THREE.Vector2(spatialR3?MATCH_LIGHTING.normalStrength:.22,spatialR3?MATCH_LIGHTING.normalStrength:.22),roughnessMap:assetPack?.textures[`grass-roughness-${assetPack.size}.png`]||null}));stripe.rotation.x=-Math.PI/2;stripe.position.set(0,layout.pitchY,-field.length/2+(i+.5)*field.length/12);stripe.receiveShadow=true;scene.add(stripe);}
 groundLines(scene,field,professional,spatialR3);if(professional&&!assetPack)buildPitchDetails(scene,field,options.quality);
 const focusedDetail=budget.focusedPlayers,basePlayerQuality=budget.baseQuality;
 const textureAnisotropy=Math.min(options.quality==='auto'?8:16,renderer.capabilities.getMaxAnisotropy());
 const kits=assetPack?{home:texturedKit(assetPack,options.pattern),away:assetPack.textures['kit-fabric-1024.png']}:{home:kitTexture(options.color||'#c1f66b',options.pattern),away:kitTexture(opponentKitColor(options.color),'classic')};
 const surfaceMaps=assetPack?{kitNormal:assetPack.textures['kit-normal-1024.png'],kitRoughness:assetPack.textures['kit-roughness-1024.png'],bootMap:assetPack.textures['boot-leather-1024.png'],emblemMap:assetPack.textures['club-emblem-1024.png'],numberMap:assetPack.textures[`jersey-numbers-${assetPack.size}.png`]}:{};
 const models={home:[],away:[]};for(const team of['home','away'])for(let i=0;i<count;i++){const keeper=i===0,model=professional?createFootballPlayer({source:footballPlayerTemplate(basePlayerQuality,keeper,!!assetPack),...surfaceMaps,anisotropy:textureAnisotropy,color:keeper?(team==='home'?'#e5c254':'#8faabd'):team==='home'?options.color||'#c1f66b':opponentKitColor(options.color),number:i+1,shadow:renderer.shadowMap.enabled,keeper,kitMap:keeper?null:kits[team]}):buildMatchPlayer(keeper?(team==='home'?'#ebcb67':'#95b6c2'):team==='home'?options.color||'#c1f66b':opponentKitColor(options.color),count===11?i+1:[1,4,5,8,9][i],renderer.shadowMap.enabled,keeper?{}:{map:kits[team]});models[team].push(model);scene.add(model);}
 let autoResolution;
 const autoDetail=focusedDetail&&!fast,lodModels=autoDetail?{home:models.home.map((low,index)=>({low,high:null,team:'home',index,wanted:false})),away:models.away.map((low,index)=>({low,high:null,team:'away',index,wanted:false}))}:null;
 const createDetail=record=>{if(options.quality==='auto'&&autoResolution?.underPressure)return;const{team,index:i}=record;record.high=createFootballPlayer({source:footballPlayerTemplate('sharp',i===0,!!assetPack),...surfaceMaps,anisotropy:textureAnisotropy,color:i===0?(team==='home'?'#e5c254':'#8faabd'):team==='home'?options.color||'#c1f66b':opponentKitColor(options.color),number:i+1,keeper:i===0,shadow:false,kitMap:i===0?null:kits[team]});record.high.visible=false;scene.add(record.high);renderer.initTexture(record.high.userData.label.material.map);renderer.initTexture(record.high.userData.jersey.material.map);};
 const detailQueue=autoDetail?createDetailWarmQueue({create:createDetail}):null;
 const targets=s=>{let opponent=s.ball.owner?.team==='away'?s.ball.owner.index:null;if(opponent===null){let closest=Infinity;for(let i=0;i<s.away.length;i++){const p=s.away[i],distance=(p.x-s.ball.x)**2+(p.y-s.ball.y)**2;if(distance<closest){closest=distance;opponent=i;}}}return{home:s.controlled,away:opponent};};
 const refreshDetail=s=>{
  if(!autoDetail)return;const selected=targets(s);
  for(const team of['home','away'])for(let i=0;i<count;i++){
   const record=lodModels[team][i],prior=models[team][i];const selectedPlayer=i===selected[team];record.wanted=selectedPlayer&&(options.quality!=='auto'||!autoResolution?.underPressure);
   if(record.wanted&&!record.high)detailQueue.request(record);
   const active=detailPlayer(record,selectedPlayer);
   if(active!==prior)copyPlayerPose(prior,active);
   record.low.visible=active===record.low;if(record.high)record.high.visible=active===record.high;models[team][i]=active;
  }
 };
 // Initial upgrades are part of loading. Later upgrades only run in idle time.
 if(autoDetail&&options.initialState){const selected=targets(options.initialState);if(options.quality!=='auto')for(const team of['home','away']){const record=lodModels[team][selected[team]];try{createDetail(record);}catch{record.failed=true;}}refreshDetail(options.initialState);}
 const playerBatches=professional?{update:()=>updateMatchWorld(models,movingRoots)}:batchMatchPlayers(scene,models,renderer.shadowMap.enabled,Object.values(kits));scene.matrixWorldAutoUpdate=false;
 const castShadows=spatialR3?createBroadcastShadows(scene,field,count):null;
 const contact=castShadows?.mesh||new THREE.InstancedMesh((professional?new THREE.PlaneGeometry(1.1,.8):new THREE.CircleGeometry(.45,14)).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x142c1d,map:professional?contactShadowTexture():null,transparent:true,opacity:professional?.42:.28,depthWrite:false}),count*2),contactMatrix=new THREE.Matrix4();contact.frustumCulled=false;if(!castShadows)scene.add(contact);
 const ring=new THREE.Mesh(new THREE.RingGeometry(professional?.5:.65,professional?.56:.88,32),new THREE.MeshBasicMaterial({color:professional?0x69e0d0:0xd5ff7c,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;scene.add(ring);
 const marker=new THREE.Mesh(new THREE.ConeGeometry(.14,.25,3),new THREE.MeshBasicMaterial({color:professional?0x69e0d0:0xd5ff7c}));marker.rotation.z=Math.PI;scene.add(marker);
 const focusMarker=createFocusMarker(),ballRoll=createBallRoll(),ballTrail=options.version===11?createBallTrail(scene):null,cameraPlayer={},trailPoint={},visibleBall={},shadowPose={},shadowRotation=new THREE.Quaternion(),shadowScale=new THREE.Vector3(),shadowPosition=new THREE.Vector3(),shadowUp=new THREE.Vector3(0,1,0);let cameraNeedsSnap=false;
 const ball=assetPack?cloneRichPart(assetPack,'ball'):buildMatchBall(renderer.shadowMap.enabled);if(professional)ball.scale.setScalar(.66);scene.add(ball);
 const ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.2,20),new THREE.MeshBasicMaterial({color:0x102f20,transparent:true,opacity:.35,depthWrite:false}));ballShadow.rotation.x=-Math.PI/2;if(spatialR3)ballShadow.renderOrder=2;scene.add(ballShadow);
 const aimGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),aim=new THREE.Line(aimGeometry,new THREE.LineDashedMaterial({color:0xe7ffa0,dashSize:.75,gapSize:.45,transparent:true,opacity:.8,depthWrite:false}));aim.geometry.setAttribute('lineDistance',new THREE.Float32BufferAttribute([0,0],1));aim.visible=false;scene.add(aim);
 const camera=new THREE.PerspectiveCamera(48,1,.5,professional?800:320),eye=new THREE.Vector3(),target=new THREE.Vector3(),look=new THREE.Vector3(),pose=new THREE.Vector3(),frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4(),playerBounds=new THREE.Sphere(new THREE.Vector3(),2.8);
 const distancePlayers=fast?createDistancePlayers(scene,count,options.color||'#c1f66b',opponentKitColor(options.color)):null;
 if(fast)applyFastMatchMaterials(scene,models);
 configureMatchTextures(scene,textureAnisotropy);
 const movingRoots=[contact,ring,marker,ball,ballShadow,aim,...nets];scene.updateMatrixWorld(true);
 autoResolution=createAutoResolutionController({targetFps:options.targetFps||budget.targetFps});const frameStats=createMatchFrameStats();const gl=renderer.getContext(),maxSize=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),maxViewport=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
 let lastState=null,lastView='broadcast',disposed=false,api,previousTick=0,lastRender=0,tickAt=0,visualTick=-1,lastGoalStage=null,lastGoalTick=null,lastPeriod=null,pendingAutoResize=false;
 let viewport=createMatchViewport(container);
 const resize=(redraw=true,refresh=true)=>{if(disposed)return;const size=refresh?viewport.refresh():viewport,plan=matchResolution({width:size.width,height:size.height,dpr:window.devicePixelRatio||1,version:options.version,quality:options.quality,maxSize,maxViewport,scale:autoResolution.scale,fast});renderer.setSize(plan.width,plan.height,false);const actual={...plan,width:gl.drawingBufferWidth||plan.width,height:gl.drawingBufferHeight||plan.height};actual.antialias=!!gl.getContextAttributes()?.antialias;actual.is4k=options.quality==='4k'&&Math.max(actual.width,actual.height)>=3839;actual.limited=options.quality==='4k'&&!actual.is4k;options.onResolution?.(actual);camera.aspect=Math.max(.1,size.width/size.height);camera.updateProjectionMatrix();if(redraw!==false&&lastState)api.render(lastState,lastView,true);};observer=new ResizeObserver(resize);observer.observe(container);resize();
 shaderWarmup=createShaderWarmup({renderer,scene,camera});
 return api={mode:'3d',prepare:()=>shaderWarmup.prepare(),rehost(next,updates={}){if(disposed)throw Error('Kampvisningen er lukket.');observer.disconnect();container=next;Object.assign(options,updates);container.appendChild(renderer.domElement);viewport=createMatchViewport(container);observer.observe(container);resize(false,true);lastRender=0;cameraNeedsSnap=true;return api;},resume(){lastRender=0;cameraNeedsSnap=true;ballRoll.reset();autoResolution.reset();frameStats.reset();},render(s,view='broadcast',snap=false){
  if(disposed)return;const renderTime=performance.now(),frameSeconds=lastRender?(renderTime-lastRender)/1000:.02,elapsed=Math.max(0,Math.min(.1,frameSeconds));lastRender=renderTime;if(pendingAutoResize){pendingAutoResize=false;resize(false,false);}if(visualTick!==s.tick){visualTick=s.tick;tickAt=renderTime;}const r4=s.engineRevision>=4,stepMs=(options.practiceRules||getArcadeRules(s.version,s.engineRevision)).STEP_MS;const prediction=matchTickPhase({elapsedMs:options.getMatchTime?.(),tick:s.tick,stepMs,maxMs:r4?stepMs:45,snap:snap||s.version<3||!!s.replay,freeze:s.freeze,fallbackMs:renderTime-tickAt}),ballPrediction=r4?0:safeMatchPrediction(s,prediction,{continuous:spatialR3});const first=!lastState,viewChanged=lastView!==view,kickoffCut=(s.version>=10&&lastPeriod==='halftime'&&s.period==='second')||(s.goalSequence?.stage==='kickoff'&&(lastGoalStage!=='kickoff'||lastGoalTick!==s.goalSequence.startedTick));lastGoalStage=s.goalSequence?.stage;lastGoalTick=s.goalSequence?.startedTick;lastPeriod=s.period;lastState=s;lastView=view;
  refreshDetail(s);
  const controlled=s.home[s.controlled],settled=snap||first||kickoffCut||s.freeze>0,blend=motionBlend(s.version,settled?1:1-Math.exp(-24*elapsed));
  const r4Pose=r4&&!snap&&!s.replay&&!s.freeze?r4PoseFrame(s):null,fraction=prediction*1000/stepMs;
  const ballPoint=r4&&!s.replay?sampleR4Ball(s,r4Pose,fraction,r4Ball):goalBallPosition(s,ballPrediction);
  const renderRadius=visibleBallDiameter(camera.position.distanceTo(pose.set(ballPoint.x,ballPoint.z,ballPoint.y)),camera.fov,viewport.height)/2;
  const shownBall=spatialR3?ballSurfacePose(ballPoint,renderRadius,visibleBall):ballPoint;
  const playerPoint=r4?sampleR4Player(s,r4Pose,'home',s.controlled,fraction,cameraPlayer):samplePlayerPose(controlled,prediction,cameraPlayer);
  const basePlan=r4?broadcastR4(s,view,camera.aspect,shownBall,playerPoint,motionPreference?.matches):matchCamera(s,view,camera.aspect,{reducedMotion:motionPreference?.matches,ballPosition:shownBall,playerPosition:playerPoint});
  const plan=r4&&view==='tactical'?basePlan:goalCameraPlan(basePlan,s,view),alpha=snap||first||viewChanged||kickoffCut?1:1-Math.exp(-7*elapsed);const nextFov=plan.fov||48;if(Math.abs(camera.fov-nextFov)>.01){camera.fov+=(nextFov-camera.fov)*(snap||first||viewChanged?1:1-Math.exp(-8*elapsed));camera.updateProjectionMatrix();}if(s.version===11&&s.engineRevision>=3){const framed=cameraRig.update(plan,elapsed,{snap:snap||first||viewChanged||kickoffCut||cameraNeedsSnap,reducedMotion:motionPreference?.matches});camera.position.set(...framed.eye);look.set(...framed.target);}else{camera.position.lerp(eye.set(...plan.eye),alpha);look.lerp(target.set(...plan.target),alpha);}cameraNeedsSnap=false;camera.lookAt(look);camera.updateMatrixWorld();frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  for(const team of['home','away'])s[team].forEach((p,i)=>{const model=models[team][i];if(!model)return;if(r4&&p.sentOff){distancePlayers?.draw((team==='home'?0:count)+i,p,model,0,false);model.userData.sentOff=true;model.visible=false;model.userData.inView=false;contactMatrix.makeScale(0,0,0);contact.setMatrixAt((team==='home'?0:count)+i,contactMatrix);return;}if(professional){if(r4){sampleR4Player(s,r4Pose,team,i,fraction,r4Player);model.position.set(r4Player.x,0,r4Player.y);}else model.position.lerp(pose.set(p.x+p.vx*prediction+(s.engineRevision>=3?(p.ax||0)*prediction*prediction*.5:0),0,p.y+p.vy*prediction+(s.engineRevision>=3?(p.ay||0)*prediction*prediction*.5:0)),blend);const turn=Math.atan2(p.facingX,p.facingY)-model.rotation.y;if(r4)model.rotation.y=r4Player.angle;else if(s.version===11&&s.engineRevision>=3)model.rotation.y=samplePlayerPose(p,prediction,model.userData.presentationPose||={}).angle;else model.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*(settled?1:1-Math.exp(-18*elapsed));const inView=playerInFrame(frustum,model.position,playerBounds),data=model.userData;
   const focused=team==='home'&&i===s.controlled,wasVisible=data.inView,wasDetailed=data.wasDetailed;
   const range=(p.x-shownBall.x)**2+(p.y-shownBall.y)**2;
   const detailed=!fast||keepDetailedPlayer(p,focused,inView,view==='tactical',range,wasDetailed);
   model.visible=inView&&detailed;data.inView=inView;data.wasDetailed=detailed;data.sentOff=false;
   const farPose=distancePlayers?.draw((team==='home'?0:count)+i,p,model,s.replayHold?0:elapsed,inView&&!detailed,prediction,kickoffCut||first);
   const poseSnap=wasVisible===false||settled||fast&&!wasDetailed&&detailed;
   const priority=focused||i===0||p.kick>0||p.tackle>0||!!s.goalSequence;
   const poseElapsed=fast?takeMatchPose(data,renderTime,priority,inView&&detailed,poseSnap,elapsed):elapsed;
   if(poseElapsed>=0)animateFootballPlayer(model,p,s,team,i,s.replayHold?0:poseElapsed,inView,poseSnap,s.version===11&&s.engineRevision>=3?prediction:0);model.userData.label.visible=(s.version>=11||view==='follow')&&team==='home'&&i===s.controlled;if(spatialR3){const shadow=playerContactShadow(p,model.rotation.y,shadowPose);shadowRotation.setFromAxisAngle(shadowUp,shadow.angle);let supportX=0,supportZ=0;
   if(farPose){
    const foot=farPose.plant[0]?0:3,cos=Math.cos(model.rotation.y),sin=Math.sin(model.rotation.y);
    const x=farPose.feet[foot]*.48,z=farPose.feet[foot+2]*.48;
    supportX=x*cos+z*sin;supportZ=z*cos-x*sin;
   }
   shadowPosition.set(model.position.x+supportX,.061,model.position.z+supportZ);shadowScale.set(shadow.width,1,shadow.depth);contactMatrix.compose(shadowPosition,shadowRotation,shadowScale);}else contactMatrix.makeTranslation(model.position.x,.055,model.position.z);contact.setMatrixAt((team==='home'?0:count)+i,contactMatrix);return;}model.position.lerp(pose.set(p.x+p.vx*prediction,p.dive>0?.2:-.085,p.y+p.vy*prediction),blend);const turn=Math.atan2(p.facingX,p.facingY)-model.rotation.y;if(s.version===11&&s.engineRevision>=3)model.rotation.y=samplePlayerPose(p,prediction,model.userData.presentationPose||={}).angle;else model.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*(settled?1:1-Math.exp(-18*elapsed));if(s.version>=4&&team==='home'&&i===s.controlled&&s.skillTicks>0)model.rotation.y=Math.atan2(p.facingX,p.facingY)+(1-s.skillTicks/10)*Math.PI*2;model.rotation.z=p.dive>0?1.15:0;const stride=Math.min(1,Math.hypot(p.vx,p.vy)/7),phase=(model.userData.gait??i*1.7)+Math.hypot(p.vx,p.vy)*elapsed*1.8;model.userData.gait=phase;model.userData.torso.rotation.x=-stride*.09;model.userData.torso.rotation.y=p.cooldown>12?Math.sin((18-p.cooldown)*.45)*.18:0;model.userData.legs.forEach((leg,n)=>{leg.rotation.x=Math.sin(phase+n*Math.PI)*.68*stride+(p.cooldown>12&&n===1?-.65:0);});model.userData.knees.forEach((knee,n)=>{knee.rotation.x=Math.max(0,Math.sin(phase+n*Math.PI))*.85*stride;});model.userData.arms.forEach((arm,n)=>{const celebrating=isGoalCelebrant(s,team,i,p);arm.rotation.x=celebrating?-2.6:-Math.sin(phase+n*Math.PI)*.55*stride;arm.rotation.z=celebrating?(n===0?-.3:.3):0;});model.userData.elbows.forEach(elbow=>{elbow.rotation.x=-.3-stride*.45;});if(spatialR3){const shadow=playerContactShadow(p,model.rotation.y,shadowPose);shadowRotation.setFromAxisAngle(shadowUp,shadow.angle);shadowPosition.set(model.position.x,.061,model.position.z);shadowScale.set(shadow.width,1,shadow.depth);contactMatrix.compose(shadowPosition,shadowRotation,shadowScale);}else contactMatrix.makeTranslation(model.position.x,.055,model.position.z);contact.setMatrixAt((team==='home'?0:count)+i,contactMatrix);model.userData.label.visible=team==='home'&&i===s.controlled;});
  distancePlayers?.finish();castShadows?.update(models);contact.instanceMatrix.needsUpdate=true;
  const focus=models.home[s.controlled].position;ring.position.set(focus.x,.07,focus.z);ring.scale.setScalar(1+(s.shotCharge||s.passCharge||0)/60);marker.position.set(focus.x,professional?2.34:2.97,focus.z);ball.position.lerp(pose.set(shownBall.x,spatialR3?shownBall.z:Math.max(professional?.155:.22,ballPoint.z-(professional?.065:0)),shownBall.y),r4?1:blend);const tickDelta=Math.max(0,Math.min(4,s.tick-previousTick));const spinStep=ballSpinStep(s.version,{elapsed,tickDelta,paused:!!s.replayHold||s.freeze>0});if(s.version===11&&s.engineRevision>=3)ballRoll.update(ball,ballPoint,s.ball,elapsed,{reset:first||kickoffCut,paused:!!s.replayHold||s.freeze>0,radius:renderRadius});else{ ball.rotation.x+=s.ball.vy*spinStep;ball.rotation.z-=s.ball.vx*spinStep; }previousTick=s.tick;ballShadow.position.set(ball.position.x,.05,ball.position.z);ballShadow.scale.setScalar(1+Math.min(2,s.ball.z)*.16);
 for(const net of nets){const positions=net.geometry.attributes.position,active=deformGoalNet(positions.array,net.userData.restNet,s,net.userData.netSign,field,prediction);if(active){positions.needsUpdate=true;net.userData.netDeformed=true;}else if(net.userData.netDeformed){positions.array.set(net.userData.restNet);positions.needsUpdate=true;net.userData.netDeformed=false;}}
  aim.visible=false;if(s.version>=3&&s.passCharge>0&&s.ball.owner?.team==='home'&&s.ball.owner.index===s.controlled){const index=((options.practiceRules||getArcadeRules(s.version,s.engineRevision)).passTarget||assistedPass)(s,'home',s.controlled,s.lastMask);if(index!==null){const mate=s.home[index],positions=aim.geometry.attributes.position;positions.setXYZ(0,focus.x,.13,focus.z);positions.setXYZ(1,mate.x,.13,mate.y);positions.needsUpdate=true;aim.geometry.computeBoundingSphere();const distances=aim.geometry.attributes.lineDistance;distances.setX(1,Math.hypot(mate.x-focus.x,mate.y-focus.z));distances.needsUpdate=true;aim.visible=true;}}
  const screen=pose.copy(focus).setY(1.1).project(camera);if(s.version<5&&(Math.abs(screen.x)>.9||screen.y<-.75||screen.y>.78)){camera.position.copy(eye);look.copy(target);camera.fov=nextFov;camera.updateProjectionMatrix();camera.lookAt(look);}if(spatialR3){ball.scale.setScalar(renderRadius/.19);ballShadow.position.set(ball.position.x+Math.max(0,ballPoint.z-.22)*.22,.062,ball.position.z-Math.max(0,ballPoint.z-.22)*.15);ballShadow.scale.setScalar(Math.max(1,renderRadius/.125)*shownBall.shadowScale);ballShadow.material.opacity=shownBall.shadowOpacity;}else if(s.version>=6){const diameter=visibleBallDiameter(camera.position.distanceTo(ball.position),camera.fov,viewport.height);ball.scale.setScalar(diameter/.38);ball.position.y=Math.max(.03+diameter/2,ballPoint.z-.22+.03+diameter/2);ballShadow.scale.setScalar(Math.max(1,diameter/.25));}if(s.engineRevision>=3){trailPoint.x=ball.position.x;trailPoint.y=ball.position.z;trailPoint.z=ball.position.y;ballTrail?.update(trailPoint,s,renderTime/1000,{reset:first||kickoffCut,reducedMotion:motionPreference?.matches});}stadium.setCameraView?.(camera.position,look);stadium.react?.(s,elapsed,motionPreference?.matches);playerBatches.update();if(spatialR3)focusMarker(models.home[s.controlled],marker);renderer.render(scene,camera);const renderMs=performance.now()-renderTime;if(options.quality==='auto'&&!snap&&!document.hidden&&autoResolution.sample(frameSeconds,renderTime,{renderMs}))pendingAutoResize=true;const stats=frameStats(renderTime);if(stats)options.onPerformance?.({...stats,profile:fast?'mobile-3d':'detail-3d',assetPack:assetPack?55:0,textureSize:assetPack?.size||0,renderMs:Math.round(renderMs*10)/10,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,resolutionScale:autoResolution.scale});
 },dispose(){disposed=true;ballTrail?.dispose();shaderWarmup.dispose();detailQueue?.dispose();lastState=null;observer.disconnect();const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();scene.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
 }catch(error){shaderWarmup?.dispose();observer?.disconnect();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();throw error;}
}
function simpleScene(container,options){
 const canvas=document.createElement('canvas');container.appendChild(canvas);
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Banegrafikken kan ikke åbnes.');
 const background=document.createElement('canvas'),pitch=background.getContext('2d');
 const r4Ball={},r4Player={},drawPlayer=createMatch2DPlayers(),frameStats=createMatchFrameStats();
 let lastRender=0,lastPeriod,lastKickoff=false;
 let lastState=null,disposed=false,api,cachedField='',scale=1,landscape=true;
 const drawPitch=field=>{
  background.width=canvas.width;background.height=canvas.height;
  const w=canvas.width,h=canvas.height;landscape=w>=h;
  scale=Math.min(w/((landscape?field.length:field.width)+12),h/((landscape?field.width:field.length)+12));
  pitch.fillStyle='#102c32';pitch.fillRect(0,0,w,h);pitch.save();pitch.translate(w/2,h/2);if(landscape)pitch.rotate(Math.PI/2);
  for(let i=0;i<12;i++){pitch.fillStyle=i%2?'#2c754b':'#286a44';pitch.fillRect(-field.width/2*scale,(-field.length/2+i*field.length/12)*scale,field.width*scale,field.length/12*scale);}
  pitch.strokeStyle='#d8ebd1';pitch.lineWidth=1.25;pitch.strokeRect(-field.width/2*scale,-field.length/2*scale,field.width*scale,field.length*scale);
  pitch.beginPath();pitch.moveTo(-field.width/2*scale,0);pitch.lineTo(field.width/2*scale,0);pitch.stroke();pitch.beginPath();pitch.arc(0,0,field.width*.135*scale,0,Math.PI*2);pitch.stroke();
  for(const sign of [-1,1]){
   const end=sign*field.length/2,depth=field.length*.17,goal=field.width*.135;
   pitch.strokeRect(-field.width*.27*scale,(sign<0?end:end-depth)*scale,field.width*.54*scale,depth*scale);
   pitch.strokeRect(-field.width*.12*scale,(sign<0?end:end-field.length*.055)*scale,field.width*.24*scale,field.length*.055*scale);
   pitch.strokeRect(-goal/2*scale,(sign<0?end-1.2:end)*scale,goal*scale,1.2*scale);
  }
  pitch.restore();
 };
 const resize=()=>{if(disposed)return;canvas.width=Math.max(1,Math.round(container.clientWidth*1.3));canvas.height=Math.max(1,Math.round(container.clientHeight*1.3));cachedField='';if(lastState)api.render(lastState);};
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 return api={mode:'simple',get controlView(){return landscape?'diagram':'stadium';},prepare:()=>Promise.resolve({status:disposed?'disposed':'skipped'}),resume(){lastRender=0;frameStats.reset();},render(state,view='broadcast',snap=false){
  if(disposed)return;lastState=state;
  const now=performance.now(),elapsed=lastRender?Math.min(.12,Math.max(0,(now-lastRender)/1000)):0;
  const atKickoff=!!state.openingKickoff||state.goalSequence?.stage==='kickoff';
  const poseSnap=snap||!lastRender||atKickoff&&!lastKickoff||lastPeriod!==state.period;
  lastRender=now;lastPeriod=state.period;lastKickoff=atKickoff;
  const field=state.field||{width:40,length:64},key=field.width+':'+field.length;
  if(cachedField!==key){drawPitch(field);cachedField=key;}
  ctx.drawImage(background,0,0);ctx.save();ctx.translate(canvas.width/2,canvas.height/2);if(landscape)ctx.rotate(Math.PI/2);
  const r4=state.engineRevision>=4,stepMs=(options.practiceRules||getArcadeRules(state.version,state.engineRevision)).STEP_MS;
  const prediction=matchTickPhase({elapsedMs:options.getMatchTime?.(),tick:state.tick,stepMs,maxMs:r4?stepMs:45,snap:snap||state.version<3||!!state.replay,freeze:state.freeze,fallbackMs:0});
  const r4Pose=r4&&!snap&&!state.replay&&!state.freeze?r4PoseFrame(state):null,fraction=prediction*1000/stepMs;
  for(const team of ['home','away'])for(let i=0;i<state[team].length;i++){
   const player=state[team][i];
   const shown=r4?sampleR4Player(state,r4Pose,team,i,fraction,r4Player):state.version===11&&state.engineRevision>=3?samplePlayerPose(player,prediction,r4Player):null;
   const px=shown?.x??player.x+(player.vx||0)*prediction,py=shown?.y??player.y+(player.vy||0)*prediction;
   if(shown){
    const color=i===0?'#e7c56d':team==='home'?options.color||'#c1f66b':opponentKitColor(options.color);
    drawPlayer(ctx,state,team,i,player,px,py,shown.angle,scale,landscape,state.replayHold?0:elapsed,prediction,color,poseSnap);continue;
   }
   const x=px*scale,y=py*scale,radius=Math.max(4,scale*.9);
   ctx.fillStyle='#071e2d66';ctx.beginPath();ctx.ellipse(x,y+scale*.4,radius,radius*.6,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=i===0?'#e7c56d':team==='home'?options.color||'#c1f66b':opponentKitColor(options.color);ctx.strokeStyle='#102a33';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
   if(team==='home'&&i===state.controlled){ctx.strokeStyle='#eaffab';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,radius+3,0,Math.PI*2);ctx.stroke();}
  }
  const point=r4&&!state.replay?sampleR4Ball(state,r4Pose,fraction,r4Ball):goalBallPosition(state,r4?0:safeMatchPrediction(state,prediction));
  ctx.fillStyle='#f7f9ee';ctx.strokeStyle='#102a33';ctx.lineWidth=1;ctx.beginPath();ctx.arc(point.x*scale,(point.y-point.z*.4)*scale,Math.max(3,.35*scale),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  const measured=frameStats(now);if(measured)options.onPerformance?.({...measured,profile:'canvas-2d',renderMs:performance.now()-now});
 },dispose(){disposed=true;lastState=null;observer.disconnect();canvas.remove();background.width=background.height=0;}};
}

export function createMatchScene(container,options={}){
 if(options.quality!=='simple'){try{return webglScene(container,options);}catch{container.replaceChildren();}}
 return simpleScene(container,options);
}

export async function prepareMatchSceneAssets({version=1,engineRevision=1,quality='auto'}={}){
 const rich=version===11&&engineRevision>=3;
 const fast=usesFastMatchRender(version,engineRevision,quality);
 if(rich&&quality!=='simple')await preloadRichMatchAssets(quality,fast);
 if(version>=5&&quality!=='simple')await Promise.all(version>=6&&['auto','sharp'].includes(quality)?[preloadFootballPlayers('auto',rich),...(!fast?[preloadFootballPlayers('sharp',rich)]:[])]:[preloadFootballPlayers(quality,rich)]);
}
