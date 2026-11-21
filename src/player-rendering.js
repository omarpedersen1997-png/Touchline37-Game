import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// SkeletonUtils clones one palette for every clothing mesh. Parts with the
// same bones and inverses can use one palette without sharing another player.
export function sharePlayerSkeletons(human) {
 const palettes=[];
 human.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const own=mesh.skeleton;
  const shared=palettes.find(s=>s.bones.length===own.bones.length&&s.bones.every((b,i)=>b===own.bones[i]&&s.boneInverses[i].equals(own.boneInverses[i])));
  if(shared&&shared!==own){mesh.skeleton=shared;own.dispose();}
  else if(!shared)palettes.push(own);
 });
 return palettes.length;
}

const geometryCache=new WeakMap();
// Legacy: opaque untextured parts. TEST55 may also merge mapped clothing
// only when every texture/surface parameter matches; UVs and tint survive.
// Vertex colours retain each part's exact linear colour. Textured skin, hair,
// eyes and shirts stay separate, with their original maps and alpha settings.
export function mergePlayerClothing(human,source,allowMapped=false) {
 const groups=[];
 human.traverse(mesh=>{
  const m=mesh.material;
  if(!mesh.isSkinnedMesh||Array.isArray(m)||!m?.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.transparent||m.opacity!==1||m.alphaTest||m.vertexColors||(!(allowMapped&&/Football|Sneaker/.test(m.name))&&Object.keys(m).some(k=>/Map$|^map$/.test(k)&&m[k]?.isTexture))||Object.keys(mesh.geometry.morphAttributes).length)return;
  mesh.updateMatrix();
  let group=groups.find(g=>g[0].parent===mesh.parent&&g[0].skeleton===mesh.skeleton&&g[0].matrix.equals(mesh.matrix)&&g[0].bindMatrix.equals(mesh.bindMatrix)&&g[0].bindMode===mesh.bindMode&&g[0].material.roughness===m.roughness&&g[0].material.metalness===m.metalness&&g[0].material.side===m.side&&g[0].material.emissive.equals(m.emissive)&&g[0].material.normalScale.equals(m.normalScale)&&Object.keys(m).every(k=>!m[k]?.isTexture||m[k]===g[0].material[k])&&Object.keys(g[0].material).every(k=>!g[0].material[k]?.isTexture||m[k]===g[0].material[k]));
  if(!group)groups.push(group=[]);
  group.push(mesh);
 });
 let saved=0;
 let cache=geometryCache.get(source);if(!cache){cache=new Map();geometryCache.set(source,cache);}
 for(const parts of groups){
  if(parts.length<2)continue;
  const first=parts[0],key=parts.map(p=>p.geometry.uuid+':'+p.material.color.toArray().join(',')).join('|');
  let geometry=cache.get(key);
  if(!geometry){
   const pieces=parts.map(p=>{const g=p.geometry.clone(),color=p.material.color,n=g.attributes.position.count,values=new Float32Array(n*3);for(let i=0;i<n;i++)color.toArray(values,i*3);g.setAttribute('color',new THREE.BufferAttribute(values,3));return g;});
   geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
   if(!geometry)continue;
   geometry.computeBoundingSphere();cache.set(key,geometry);
  }
  const material=first.material.clone();material.name='Football clothing';material.color.set(0xffffff);material.vertexColors=true;
  const merged=new THREE.SkinnedMesh(geometry,material);merged.name='Merged football clothing';merged.matrix.copy(first.matrix);merged.matrix.decompose(merged.position,merged.quaternion,merged.scale);merged.bindMode=first.bindMode;merged.bind(first.skeleton,first.bindMatrix);merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;merged.frustumCulled=false;
  merged.userData.parts=parts.map(p=>p.material.name);
  first.parent.add(merged);
  for(const p of parts){p.removeFromParent();p.material.dispose();}
  saved+=parts.length-1;
 }
 return saved;
}

// The stadium is static. Update moving roots explicitly instead of walking
// the stands, hidden LODs and all off-screen skeletons on every frame.
export function updateMatchWorld(models,dynamics) {
 for(const team of ['home','away'])for(const model of models[team])if(model.visible)model.updateMatrixWorld(true);
 for(const root of dynamics)root.updateMatrixWorld(true);
}

export function playerInFrame(frustum,position,bounds) {
 bounds.center.copy(position);bounds.center.y+=1;
 return frustum.intersectsSphere(bounds);
}

export function copyPlayerPose(from,to) {
 to.position.copy(from.position);to.rotation.copy(from.rotation);
 to.userData.motionTime=from.userData.motionTime;
 for(const key of ['motionClip','motionX','motionZ','motionBlend','motionRoot'])to.userData[key]=from.userData[key];
 if(to.userData.motionFrom&&from.userData.motionFrom)for(const name of Object.keys(to.userData.motionFrom))if(from.userData.motionFrom[name])to.userData.motionFrom[name].copy(from.userData.motionFrom[name]);
 if(to.userData.human&&from.userData.human){to.userData.human.position.copy(from.userData.human.position);to.userData.human.quaternion.copy(from.userData.human.quaternion);}
 to.userData.inView=from.userData.inView;
 for(const name of Object.keys(to.userData.bones)){
  const old=from.userData.bones[name];if(!old)continue;
  to.userData.bones[name].quaternion.copy(old.quaternion);
  to.userData.bones[name].position.copy(old.position);
 }
}
