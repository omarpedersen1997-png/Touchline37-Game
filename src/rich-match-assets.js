import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {matchAssetRoot} from './match-asset-config.js';
let pending=null,library=null;const textureCache=new Map();
export async function preloadRichMatchAssets(quality='auto'){
 if(!matchAssetRoot)return null;
 if(!pending)pending=new GLTFLoader().loadAsync(matchAssetRoot+'/stadium-kit.glb').then(g=>{library=g.scene;library.updateMatrixWorld(true);return library;}).catch(e=>{pending=null;throw e;});
 const size=quality==='auto'?1024:2048,names=[`grass-color-${size}.png`,`grass-normal-${size}.png`,`grass-roughness-${size}.png`,`jersey-numbers-${size}.png`,'kit-fabric-1024.png','kit-normal-1024.png','kit-roughness-1024.png','boot-leather-1024.png','stadium-board-2048.png','club-emblem-1024.png'];
 await Promise.all([pending,...names.map(name=>{if(!textureCache.has(name))textureCache.set(name,new THREE.TextureLoader().loadAsync(matchAssetRoot+'/'+name).catch(e=>{textureCache.delete(name);throw e;}));return textureCache.get(name);})]);
 const textures=Object.fromEntries(await Promise.all(names.map(async name=>[name,await textureCache.get(name)])));
 for(const [name,t]of Object.entries(textures)){t.colorSpace=/normal|roughness/.test(name)?THREE.NoColorSpace:THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;}
 ready.set(quality,{library,textures,size});return ready.get(quality);
}
const ready=new Map();
export function richMatchAssets(quality='auto'){return ready.get(quality)||null;}
export function texturedKit(pack,pattern='classic'){
 const fabric=pack.textures['kit-fabric-1024.png'];if(!['stripe','hoop'].includes(pattern))return fabric;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');c.drawImage(fabric.image,0,0,1024,1024);c.fillStyle='rgba(10,24,30,.65)';
 if(pattern==='stripe')for(let x=0;x<1024;x+=256)c.fillRect(x,0,100,1024);
 else for(let y=0;y<1024;y+=224)c.fillRect(0,y,1024,80);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function cloneRichPart(pack,name){const root=pack.library.getObjectByName(name);if(!root)throw Error('Missing stadium module: '+name);return root.clone(true);}

// Each model primitive is one static instanced draw, independent of seat count.
export function instanceRichPart(scene,pack,name,placements,{tint=false}={}){
 const root=pack.library.getObjectByName(name);if(!root)throw Error('Missing stadium module: '+name);
 root.updateWorldMatrix(true,true);const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),local=new THREE.Matrix4(),matrix=new THREE.Matrix4(),placed=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(),position=new THREE.Vector3(),color=new THREE.Color(),meshes=[];
 root.traverse(part=>{if(!part.isMesh)return;const mesh=new THREE.InstancedMesh(part.geometry,part.material,placements.length);local.multiplyMatrices(inverse,part.matrixWorld);
  for(let i=0;i<placements.length;i++){const p=placements[i];position.set(p.x,p.y||0,p.z);scale.set(p.sx||1,p.sy||1,p.sz||1);q.setFromAxisAngle(up,p.angle||0);placed.compose(position,q,scale);matrix.multiplyMatrices(placed,local);mesh.setMatrixAt(i,matrix);if(tint)mesh.setColorAt(i,color.setHex([0xa8c4d3,0xd2dc8c,0x819a88,0x927d70][i%4]));}
  mesh.computeBoundingSphere();mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);
 });return meshes;
}
export function buildRichStadium(scene,field,quality,pack){
 const w=field.width/2,l=field.length/2,stands=[],audience=[],lamps=[],benches=[],flags=[];
 for(const side of [-1,1]){
  for(let z=-l+7;z<l;z+=12.5)stands.push({x:side*(w+8),z,angle:side<0?Math.PI/2:-Math.PI/2});
  for(let x=-w+7;x<w;x+=12.5)stands.push({x,z:side*(l+8),angle:side<0?0:Math.PI});
  for(const x of [-w,w]){flags.push({x,z:side*l});lamps.push({x:x+Math.sign(x)*13,z:side*(l+15)});}
 }
 const automatic=quality==='auto',stride=automatic?4:2,rowStride=automatic?2:1;
 for(const stand of stands)for(let row=0;row<6;row+=rowStride)for(let col=0;col<15;col+=stride){if(col===7)continue;const across=-5.55+col*.79,depth=-(row*.85+.1),cos=Math.cos(stand.angle),sin=Math.sin(stand.angle);audience.push({x:stand.x+across*cos+depth*sin,y:.1+row*.48,z:stand.z-across*sin+depth*cos,angle:stand.angle});}
 benches.push({x:-(w+4),z:-14,angle:Math.PI/2},{x:-(w+4),z:14,angle:Math.PI/2});
 const structures=[...instanceRichPart(scene,pack,automatic?'stand-low':'stand',stands),...instanceRichPart(scene,pack,'floodlight',lamps),...instanceRichPart(scene,pack,'bench',benches),...instanceRichPart(scene,pack,'flag',flags)],crowds=instanceRichPart(scene,pack,quality==='4k'?'spectator':'spectator-low',audience,{tint:true});
 const surround=new THREE.Mesh(new THREE.PlaneGeometry(field.width+80,field.length+80),new THREE.MeshStandardMaterial({color:0x263c34,roughness:1}));surround.rotation.x=-Math.PI/2;surround.position.y=-.035;scene.add(surround);
 const board=pack.textures['stadium-board-2048.png'],boardMat=new THREE.MeshBasicMaterial({map:board});
 for(const side of [-1,1])for(let z=-l+10;z<l;z+=22){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(20,1.1),boardMat);mesh.position.set(side*(w+4),.8,z);mesh.rotation.y=side<0?Math.PI/2:-Math.PI/2;scene.add(mesh);}
 // Camera-side clipping prevents benches/roof geometry crossing the lens.
 const planes=[new THREE.Plane(new THREE.Vector3(-1,0,0),w+3),new THREE.Plane(new THREE.Vector3(0,0,-1),l+3)];
 for(const mesh of [...structures,...crowds]){mesh.material=mesh.material.clone();mesh.material.clippingPlanes=planes;}
 let brightness=.8;const lampsMaterials=structures.map(m=>m.material).filter(m=>m.emissive?.r>.1);
 return {layout:{pitchY:.03},crowds,react(state,dt,reducedMotion){const target=!reducedMotion&&['net','celebration'].includes(state.goalSequence?.stage)?1.1:.8;brightness+=(target-brightness)*(1-Math.exp(-3*Math.min(.1,dt)));for(const m of lampsMaterials)m.emissiveIntensity=brightness;},setCameraView(eye,target){const dx=eye.x-target.x,dz=eye.z-target.z;planes[0].normal.x=dx>=0?-1:1;planes[1].normal.z=dz>=0?-1:1;}};
}
export function buildRichGoals(scene,field,pack){
 const nets=[];
 for(const sign of [-1,1]){
  const group=cloneRichPart(pack,'goal');group.position.z=sign*field.length/2;group.rotation.y=sign>0?Math.PI:0;group.scale.set(field.goalWidth/7.32,field.goalHeight/2.44,1);scene.add(group);
  const root=cloneRichPart(pack,'net');root.updateMatrixWorld(true);
  root.traverse(part=>{if(!part.isMesh)return;part.geometry=part.geometry.clone();part.geometry.applyMatrix4(part.matrixWorld);const pos=part.geometry.attributes.position;
   for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)*field.goalWidth/7.32,pos.getY(i)*field.goalHeight/2.44,-pos.getZ(i)*sign);
   part.geometry.computeVertexNormals();part.geometry.computeBoundingBox();part.geometry.computeBoundingSphere();part.position.set(0,0,sign*field.length/2);part.quaternion.identity();part.scale.set(1,1,1);part.userData={netSign:sign,restNet:pos.array.slice(),netDeformed:false};nets.push(part);
  });for(const mesh of nets.filter(m=>m.userData.netSign===sign))scene.add(mesh);
 }return nets;
}
