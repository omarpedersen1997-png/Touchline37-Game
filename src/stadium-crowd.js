import * as THREE from 'three';

const COLUMNS=8,ROWS=4,CELL=128;
const CLOTHES=['#193550','#e9e9df','#a8bdc9','#496b94','#8f3438','#bdc355','#336652','#35384b'];
const SKIN=['#e2b594','#bb8864','#896049','#624432'];

function spectatorAtlas(){
 const canvas=document.createElement('canvas');canvas.width=COLUMNS*CELL;canvas.height=ROWS*CELL;
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
 for(let row=0;row<ROWS;row++)for(let col=0;col<COLUMNS;col++){
  c.save();c.translate(col*CELL,row*CELL);
  // A seated adult silhouette: lap, folded legs, shoulders, arms and head.
  c.fillStyle='#202b37';c.beginPath();c.moveTo(35,88);c.lineTo(94,88);c.lineTo(105,105);c.lineTo(88,115);c.lineTo(68,103);c.lineTo(59,119);c.lineTo(35,119);c.closePath();c.fill();
  c.fillStyle=CLOTHES[col];c.beginPath();c.moveTo(43,43);c.lineTo(83,43);c.lineTo(98,58);c.lineTo(90,94);c.lineTo(34,94);c.lineTo(28,58);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,.16)';c.fillRect(47,49,5,36);c.fillRect(58,67,22,3);
  c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.moveTo(85,49);c.lineTo(90,94);c.lineTo(76,94);c.closePath();c.fill();
  c.fillStyle=SKIN[row];
  if(col%3===0){
   c.beginPath();c.moveTo(30,55);c.lineTo(20,53);c.lineTo(12,29);c.lineTo(20,25);c.lineTo(29,45);c.lineTo(36,46);c.closePath();c.fill();c.beginPath();c.ellipse(15,23,5,7,-.3,0,Math.PI*2);c.fill();
  }else{c.beginPath();c.moveTo(29,58);c.lineTo(40,61);c.lineTo(43,91);c.lineTo(36,98);c.lineTo(29,88);c.closePath();c.fill();}
  c.beginPath();c.moveTo(89,60);c.lineTo(98,57);c.lineTo(103,91);c.lineTo(93,99);c.lineTo(86,91);c.lineTo(92,85);c.closePath();c.fill();
  c.fillRect(55,34,17,15);c.beginPath();c.ellipse(64,26,13,16,0,0,Math.PI*2);c.fill();
  c.fillStyle=['#30231e','#58422f','#242326','#80654a'][(row+col)%4];c.beginPath();c.ellipse(64,19,13,9,0,Math.PI,Math.PI*2);c.lineTo(77,24);c.lineTo(72,18);c.lineTo(54,18);c.lineTo(51,26);c.closePath();c.fill();
  c.fillStyle='#29272a';c.fillRect(57,26,3,2);c.fillRect(68,26,3,2);c.fillStyle='rgba(78,42,32,.6)';c.fillRect(61,35,7,2);
  // A contrasting collar/scarf stays legible when the person is only pixels tall.
  c.strokeStyle=col%2?'#f0eed7':'#bccb86';c.lineWidth=3;c.beginPath();c.moveTo(52,44);c.lineTo(63,52);c.lineTo(76,44);c.stroke();
  c.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 return texture;
}

function spectatorGeometry(){
 const geometry=new THREE.BufferGeometry(),w=.34,h=.56;
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-w,-h,0,w,-h,0,w,h,0,-w,h,0,0,-h,-w,0,-h,w,0,h,w,0,h,-w],3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1],2));
 geometry.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

// Crossed cutout cards retain perspective and face/kit detail at crowd distance.
// Four triangles per spectator replace 86 triangles in the old capsule/head pair.
// One batch per stand allows CPU cutaway before submitting any hidden vertices.
export function buildStadiumCrowd(scene,seatPoints,quality='auto',field={width:60,length:96}){
 const texture=spectatorAtlas(),material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,alphaTest:.25,transparent:false,depthWrite:true,alphaToCoverage:true});material.name='Spectator atlas';material.forceSinglePass=true;
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 crowdTile;\nvarying vec2 vCrowdTile;').replace('#include <uv_vertex>','#include <uv_vertex>\nvCrowdTile=crowdTile;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vCrowdTile;').replace('#include <map_fragment>',`vec2 crowdUv=(vMapUv*0.984375+0.0078125)*vec2(${1/COLUMNS},${1/ROWS})+vCrowdTile;\n${THREE.ShaderChunk.map_fragment.replace(/\bvMapUv\b/g,'crowdUv')}`);
 };
 material.customProgramCacheKey=()=> 'touchline-spectator-atlas-v1';
 const w=field.width/2,l=field.length/2,groups=new Map([['x-',[]],['x+',[]],['z-',[]],['z+',[]]]);
 seatPoints.forEach((point,index)=>{const [x,,z]=point,axis=Math.abs(x)/w>=Math.abs(z)/l?'x':'z',sign=(axis==='x'?x:z)<0?'-':'+';groups.get(axis+sign).push({point,index});});
 const batches=[],source=spectatorGeometry(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),position=new THREE.Vector3(),scale=new THREE.Vector3();
 for(const[stand,points]of groups){
  if(!points.length)continue;
  const geometry=source.clone(),tiles=new Float32Array(points.length*2),mesh=new THREE.InstancedMesh(geometry,material,points.length);mesh.name='Spectators '+stand;mesh.castShadow=false;mesh.receiveShadow=false;
  points.forEach(({point:[x,y,z],index},i)=>{
   const hash=(Math.imul(index+1,2654435761)^Math.round(x*101)^Math.round(z*307))>>>0,col=hash%COLUMNS,row=(hash>>>5)%ROWS,height=.96+(hash%7)*.02;
   tiles[i*2]=col/COLUMNS;tiles[i*2+1]=(ROWS-1-row)/ROWS;
   position.set(x,y+.44,z);rotation.setFromAxisAngle(up,Math.atan2(-x,-z));scale.set(1,height,1);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);
  });
  geometry.setAttribute('crowdTile',new THREE.InstancedBufferAttribute(tiles,2));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.userData.crowd={stand,center:mesh.boundingBox.getCenter(new THREE.Vector3()),half:mesh.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(.5),trianglesPerPerson:4,variants:COLUMNS*ROWS};scene.add(mesh);batches.push(mesh);
 }
 source.dispose();
 const planes=[new THREE.Plane(),new THREE.Plane()];
 return{batches,texture,material,setCameraView(eye,target){
  const dx=eye.x-target.x,dz=eye.z-target.z;planes[0].normal.set(dx>=0?-1:1,0,0);planes[0].constant=Math.abs(dx)<.1?1e6:w+2;planes[1].normal.set(0,0,dz>=0?-1:1);planes[1].constant=Math.abs(dz)<.1?1e6:l+2;
  for(const mesh of batches){const{center,half}=mesh.userData.crowd;mesh.visible=planes.every(p=>p.distanceToPoint(center)+Math.abs(p.normal.x)*half.x+Math.abs(p.normal.z)*half.z>=0);}
 },dispose(){for(const mesh of batches){mesh.removeFromParent();mesh.geometry.dispose();mesh.dispose();}material.dispose();texture.dispose();}};
}
