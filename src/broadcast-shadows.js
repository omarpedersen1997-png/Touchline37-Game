import * as THREE from 'three';
import {contactShadowTexture} from './contact-shadow.js';

// All foot, body, head and goal-frame shadows share ONE instanced submission.
// These are soft projected approximations, not a real-time shadow-map pass.
export function createBroadcastShadows(scene,field,playersPerTeam,lightPosition){
 const players=playersPerTeam*2,total=players*3+6,geometry=new THREE.PlaneGeometry(1.1,.8).rotateX(-Math.PI/2);
 const strengths=new Float32Array(total);strengths.fill(1,0,players);strengths.fill(.38,players,players*2);strengths.fill(.25,players*2,players*3);strengths.fill(.6,players*3);
 geometry.setAttribute('shadowStrength',new THREE.InstancedBufferAttribute(strengths,1));
 const material=new THREE.MeshBasicMaterial({color:0x102b22,map:contactShadowTexture(),transparent:true,opacity:.46,depthWrite:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float shadowStrength; varying float vShadowStrength;').replace('#include <begin_vertex>','#include <begin_vertex>\nvShadowStrength = shadowStrength;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vShadowStrength;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vShadowStrength;');
 };
 material.customProgramCacheKey=()=> 'touchline-projected-shadow-58';
 const mesh=new THREE.InstancedMesh(geometry,material,total);mesh.name='R3 foot, body and goal shadows';mesh.renderOrder=2;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh);
 const hidden=new THREE.Matrix4().makeScale(0,0,0),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const dx=lightPosition?-lightPosition.x/lightPosition.y:25/55,dz=lightPosition?-lightPosition.z/lightPosition.y:-20/55,angle=Math.atan2(dx,dz);
 const place=(index,x,z,width,length,heading)=>{position.set(x,.06,z);rotation.setFromAxisAngle(up,heading);scale.set(width/1.1,1,length/.8);matrix.compose(position,rotation,scale);mesh.setMatrixAt(index,matrix);};
 let goalIndex=players*3;
 const segment=(x,z,xx,zz)=>{const length=Math.hypot(xx-x,zz-z);place(goalIndex++,(x+xx)/2,(z+zz)/2,.23,length,Math.atan2(xx-x,zz-z));};
 for(const side of [-1,1]){
  const z=side*field.length/2,w=field.goalWidth/2,h=field.goalHeight;
  segment(-w,z,-w+dx*h,z+dz*h);segment(w,z,w+dx*h,z+dz*h);segment(-w+dx*h,z+dz*h,w+dx*h,z+dz*h);
 }
 return {mesh,update(models){
  for(const team of ['home','away'])for(let i=0;i<playersPerTeam;i++){
   const model=models[team][i],p=model.position,index=(team==='home'?0:playersPerTeam)+i,height=Math.max(0,p.y);
   if(model.userData.sentOff){mesh.setMatrixAt(players+index,hidden);mesh.setMatrixAt(players*2+index,hidden);continue;}
   place(players+index,p.x+dx*(1+height),p.z+dz*(1+height),.54+height*.1,1.12+height*.1,angle);
   place(players*2+index,p.x+dx*(1.72+height),p.z+dz*(1.72+height),.33+height*.09,.38+height*.09,angle);
  }
 }};
}
