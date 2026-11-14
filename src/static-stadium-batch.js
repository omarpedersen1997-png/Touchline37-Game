import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Bake rigid stadium pieces in world space and submit each shared opaque
// material once. Clipping still happens against the same world-space planes.
export function batchStaticStadium(scene){
 scene.updateMatrixWorld(true);
 const groups=new Map();
 for(const mesh of [...scene.children]){
  if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.geometry.type==='PlaneGeometry'&&mesh.rotation.x===-Math.PI/2)continue;
  const key=mesh.material.uuid+':'+mesh.castShadow+':'+mesh.receiveShadow;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
 }
 let saved=0;
 for(const pieces of groups.values()){
  if(pieces.length<2)continue;
  const originals=pieces.map(p=>p.geometry.clone().applyMatrix4(p.matrixWorld)),geometry=mergeGeometries(originals,false);originals.forEach(g=>g.dispose());
  if(!geometry)continue;
  geometry.computeBoundingSphere();geometry.computeBoundingBox();
  const first=pieces[0],batch=new THREE.Mesh(geometry,first.material);batch.name='Batched stadium';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.userData.pieces=pieces.length;scene.add(batch);
  for(const p of pieces){p.removeFromParent();p.geometry.dispose();}
  saved+=pieces.length-1;
 }
 return saved;
}
