import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const WHITE=0xe8eddb;

function flatMarkings(field,landmarks){
 const positions=[],halfW=field.width/2,halfL=field.length/2;
 const strip=(a,b,width=.12,y=.055)=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz)||1,px=-dz/d*width/2,pz=dx/d*width/2;
  for(const [x,z]of[[a[0]+px,a[1]+pz],[b[0]+px,b[1]+pz],[b[0]-px,b[1]-pz],[a[0]+px,a[1]+pz],[b[0]-px,b[1]-pz],[a[0]-px,a[1]-pz]])positions.push(x,y,z);
 };
 const arc=(point,from,to,steps=32)=>{let previous=point(from);for(let i=1;i<=steps;i++){const next=point(from+(to-from)*i/steps);strip(previous,next);previous=next;}};
 const spot=(x,z,r=.14)=>{for(let i=0;i<20;i++){const a=i/20*Math.PI*2,b=(i+1)/20*Math.PI*2;positions.push(x,.056,z,x+Math.sin(a)*r,.056,z+Math.cos(a)*r,x+Math.sin(b)*r,.056,z+Math.cos(b)*r);}};
 const dash=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);for(let d=0;d<length;d+=1.1){const end=Math.min(length,d+.65);strip([a[0]+dx*d/length,a[1]+dz*d/length],[a[0]+dx*end/length,a[1]+dz*end/length],.09,-.024);}};
 spot(0,0);
 const penaltyDepth=Math.min(16.5,halfL*.32),spotDistance=Math.min(11,halfL*.25),radius=Math.min(9.15,field.width*.16),angle=Math.acos(Math.min(1,(penaltyDepth-spotDistance)/radius));
 for(const sign of[-1,1]){
  const z=sign*(halfL-spotDistance);spot(0,z);landmarks.penaltySpots.push([0,z]);
  arc(a=>[Math.sin(a)*radius,sign*(halfL-spotDistance-Math.cos(a)*radius)],-angle,angle);
 }
 for(const xSign of[-1,1])for(const zSign of[-1,1]){
  const x=xSign*halfW,z=zSign*halfL;
  arc(a=>[x-xSign*Math.sin(a),z-zSign*Math.cos(a)],0,Math.PI/2,16);
 }
 // The existing dugouts are centred at z ±14, behind the left touchline.
 for(const z of[-14,14]){
  const box={x0:-halfW-5.8,x1:-halfW-.75,z0:z-6.4,z1:z+6.4};landmarks.technicalAreas.push(box);
  dash([box.x0,box.z0],[box.x1,box.z0]);dash([box.x1,box.z0],[box.x1,box.z1]);dash([box.x1,box.z1],[box.x0,box.z1]);dash([box.x0,box.z1],[box.x0,box.z0]);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:WHITE,side:THREE.DoubleSide}));mesh.name='Pitch detail markings';return mesh;
}

function wearPatches(field){
 const positions=[],colors=[],halfL=field.length/2;
 // A few low-opacity, irregular wear patches, underneath all painted lines.
 const patches=[[-2,halfL-2.2,2.7,1.4],[2.1,halfL-2.7,2.5,1.8],[-1.6,-halfL+2.4,2.8,1.7],[2,-halfL+2.5,2.3,1.5],[0,halfL-11,1.4,1.1],[0,-halfL+11,1.3,1.1],[0,0,2.5,2.8]];
 for(const [patchIndex,[x,z,rx,rz]]of patches.entries())for(let i=0;i<24;i++){
  const color=new THREE.Color(patchIndex<4?0x8a8056:0x8d9b64),point=(n,scale)=>{const a=n/24*Math.PI*2,wobble=1+Math.sin(n*2.1+patchIndex)*.12;return[x+Math.sin(a)*rx*scale*wobble,.043,z+Math.cos(a)*rz*scale*wobble];};
  positions.push(x,.043,z,...point(i,1),...point(i+1,1));
  for(const alpha of[.15,0,0])colors.push(color.r,color.g,color.b,alpha);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide}));mesh.name='Goal mouth and centre wear';mesh.material.forceSinglePass=true;return mesh;
}

function cornerFlags(field,landmarks){
 const poleGeometry=new THREE.CylinderGeometry(.022,.025,1.5,6),poleMaterial=new THREE.MeshStandardMaterial({color:0xe1e5d7,roughness:.7});
 const poles=new THREE.InstancedMesh(poleGeometry,poleMaterial,4),clothGeometry=new THREE.BufferGeometry();
 const vertices=[],indices=[];
 for(let i=0;i<4;i++){const x=i/3*.48,fold=Math.sin(i*2.4)*.035;vertices.push(x,-.14,fold,x,.14-i*.015,fold);if(i<3){const v=i*2;indices.push(v,v+1,v+3,v,v+3,v+2);}}
 clothGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));clothGeometry.setIndex(indices);clothGeometry.computeVertexNormals();clothGeometry.computeBoundingSphere();
 const flags=new THREE.InstancedMesh(clothGeometry,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,side:THREE.DoubleSide}),4),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();let i=0;
 for(const sx of[-1,1])for(const sz of[-1,1]){
  const x=sx*field.width/2,z=sz*field.length/2;landmarks.cornerFlags.push([x,z]);
  matrix.makeTranslation(x,.78,z);poles.setMatrixAt(i,matrix);
  rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),sx>0?Math.PI-.25:.25);matrix.compose(new THREE.Vector3(x,1.36,z),rotation,new THREE.Vector3(1,1,1));flags.setMatrixAt(i,matrix);flags.setColorAt(i,new THREE.Color(i%2?0x73c8d0:0xc7e66a));i++;
 }
 poles.name='Corner flag poles';flags.name='Folded corner flags';poles.computeBoundingSphere();flags.computeBoundingSphere();return[poles,flags];
}

function touchlineEquipment(field,landmarks){
 const pieces=[],sources=new Map(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
 const geometry=(kind)=>{if(!sources.has(kind))sources.set(kind,kind==='box'?new THREE.BoxGeometry(1,1,1):kind==='head'?new THREE.SphereGeometry(1,8,6):kind==='cone'?new THREE.ConeGeometry(1,1,8):kind==='body'?new THREE.CapsuleGeometry(1,2,2,8):new THREE.CylinderGeometry(1,1,1,6));return sources.get(kind);};
 const add=(kind,color,x,y,z,sx,sy,sz,q=null)=>{
  const base=geometry(kind),part=base.index?base.toNonIndexed():base.clone();matrix.compose(new THREE.Vector3(x,y,z),q||new THREE.Quaternion(),new THREE.Vector3(sx,sy,sz));part.applyMatrix4(matrix);
  const c=new THREE.Color(color),values=new Float32Array(part.attributes.position.count*3);for(let i=0;i<values.length;i+=3)c.toArray(values,i);part.setAttribute('color',new THREE.BufferAttribute(values,3));pieces.push(part);
 };
 const rod=(a,b,r,color)=>{const direction=new THREE.Vector3().subVectors(b,a),mid=a.clone().add(b).multiplyScalar(.5);rotation.setFromUnitVectors(up,direction.clone().normalize());add('rod',color,mid.x,mid.y,mid.z,r,direction.length(),r,rotation);};
 const staff=(x,z,skin=0xc69a78,vest=false)=>{
  landmarks.staff.push([x,z]);add('body',vest?0x9dab55:0x263d4c,x,1.04,z,.18,.2,.145);add('head',skin,x,1.64,z,.13,.16,.13);
  add('rod',0x182934,x-.09,.39,z,.065,.8,.065);add('rod',0x182934,x+.09,.39,z,.065,.8,.065);
  rod(new THREE.Vector3(x-.2,1.3,z),new THREE.Vector3(x-.25,.85,z+.04),.055,0x263d4c);rod(new THREE.Vector3(x+.2,1.3,z),new THREE.Vector3(x+.25,.85,z+.04),.055,0x263d4c);
  add('box',0x15252b,x-.09,.045,z+.04,.13,.09,.27);add('box',0x15252b,x+.09,.045,z+.04,.13,.09,.27);
 };
 const w=field.width/2,l=field.length/2;
 for(const z of[-14,14])for(const seat of[-3,-1.5,0,1.5,3]){
  add('box',0x2b5770,-w-3.5,.48,z+seat,.6,.13,.5);add('box',0x2b5770,-w-3.77,.85,z+seat,.1,.65,.5);add('rod',0x9aa9ab,-w-3.5,.23,z+seat,.04,.46,.04);
 }
 staff(-w-1.9,-21);staff(-w-2,7,0x936847);
 // Camera operators and low tripods stay well outside the active playing area.
 for(const sign of[-1,1])for(const z of[-l*.28,l*.28]){
  const x=sign*(w+2.6);landmarks.cameras.push([x,z]);
  const top=new THREE.Vector3(x,1.33,z);for(const dx of[-.28,.28])rod(top,new THREE.Vector3(x+dx,.02,z+.28),.018,0x536067);rod(top,new THREE.Vector3(x,.02,z-.32),.018,0x536067);
  add('box',0x26343b,x,1.46,z,.42,.24,.35);rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);add('rod',0x111a20,x-sign*.27,1.45,z,.07,.23,.07,rotation);staff(x+sign*.7,z+.2,sign>0?0x956d4e:0xd8b292,true);
 }
 for(const sign of[-1,1]){
  for(const delta of[-1,0,1])add('cone',0xcf8840,-w-1.1,.12,sign*24+delta*.65,.13,.3,.13);
  add('box',0x3d6b7a,-w-4.9,.23,sign*7.8,.7,.5,.55);add('box',0xd4ddd0,-w-4.9,.51,sign*7.8,.74,.07,.59);
  add('box',0x25353f,-w-4.9,.18,sign*8.6,.6,.38,.45);
 }
 for(const sign of[-1,1])for(const z of[-l*.45,0,l*.45])for(let i=0;i<8;i++)add('box',0x43544b,sign*(w+1.35),-.018,z+i*.12-.42,.26,.015,.04);
 const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());sources.forEach(g=>g.dispose());merged.computeBoundingSphere();
 const mesh=new THREE.Mesh(merged,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}));mesh.name='Touchline equipment and match staff';return mesh;
}

/** Static detail pass: five added submissions, no per-frame animation work. */
export function buildPitchDetails(scene,field,quality='auto'){
 const root=new THREE.Group();root.name='Professional pitch details';
 const landmarks={cornerFlags:[],penaltySpots:[],technicalAreas:[],cameras:[],staff:[]};
 root.add(flatMarkings(field,landmarks),wearPatches(field),...cornerFlags(field,landmarks),touchlineEquipment(field,landmarks));scene.add(root);
 let drawCalls=0,triangles=0;root.traverse(o=>{if(!o.isMesh)return;drawCalls++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
 root.userData={quality,drawCalls,triangles,landmarks};return{root,landmarks,drawCalls,triangles};
}
