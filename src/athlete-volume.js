import {Vector3,Matrix4} from 'three';

// Presentation revision, not a new hitbox or simulation rule. Work in bind
// space around each actual bone axis; lengths, joints, UVs and weights survive.
const regions={
 Hips:['Spine',1.07,.025],Spine:['Spine1',1.1,.03],Spine1:['Spine2',1.13,.035],Spine2:['Neck',1.13,.035],
 LeftArm:['LeftForeArm',1.20,.032],RightArm:['RightForeArm',1.20,.032],
 LeftForeArm:['LeftHand',1.13,.023],RightForeArm:['RightHand',1.13,.023],
 LeftUpLeg:['LeftLeg',1.23,.04],RightUpLeg:['RightLeg',1.23,.04],
 LeftLeg:['LeftFoot',1.16,.029],RightLeg:['RightFoot',1.16,.029],
 LeftFoot:['LeftToeBase',1.12,.022],RightFoot:['RightToeBase',1.12,.022],
 LeftHand:[null,1.16,.018],RightHand:[null,1.16,.018]
};
const cache=new WeakMap();
export function athleteGeometry(mesh){
 const source=mesh.geometry;const key=mesh.name+'|'+mesh.bindMatrix.elements.join(',');let variants=cache.get(source);if(variants?.has(key))return variants.get(key);
 const {position,skinIndex,skinWeight}=source.attributes;
 if(!position||!skinIndex||!skinWeight)return source;
 const skeleton=mesh.skeleton,rest=skeleton.boneInverses.map(m=>new Matrix4().copy(m).invert()),indices=new Map(skeleton.bones.map((b,i)=>[b.name,i]));
 const origins=rest.map(m=>new Vector3().setFromMatrixPosition(m)),axes=skeleton.bones.map((bone,i)=>{
  const region=regions[bone.name];if(!region)return null;
  const fallback=bone.children.find(b=>/Middle|Index/.test(b.name))||bone.children.find(b=>b.isBone);
  const child=indices.get(region[0])??indices.get(fallback?.name),axis=child===undefined?new Vector3(0,1,0):new Vector3().subVectors(origins[child],origins[i]).normalize();
  return{axis,gain:region[1]-1,limit:region[2]};
 });
 const geometry=source.clone(),target=geometry.attributes.position,p=new Vector3(),offset=new Vector3(),radial=new Vector3(),delta=new Vector3();
 for(let i=0;i<position.count;i++){
  p.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix);delta.set(0,0,0);
  for(let j=0;j<4;j++){
   const weight=skinWeight.getComponent(i,j),index=skinIndex.getComponent(i,j),region=axes[index];if(!weight||!region)continue;
   offset.subVectors(p,origins[index]);radial.copy(offset).addScaledVector(region.axis,-offset.dot(region.axis));
   const length=radial.length();if(length>1e-7)delta.addScaledVector(radial,weight*Math.min(region.gain,region.limit/length));
  }
  p.add(delta).applyMatrix4(mesh.bindMatrixInverse);target.setXYZ(i,p.x,p.y,p.z);
 }
 target.needsUpdate=true;geometry.computeVertexNormals();geometry.deleteAttribute('tangent');geometry.computeBoundingSphere();geometry.computeBoundingBox();if(!variants){variants=new Map();cache.set(source,variants);}variants.set(key,geometry);return geometry;
}
export function applyAthleteVolume(human){human.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.geometry=athleteGeometry(mesh);});}
export async function prepareAthleteVolumes(source,{yieldTask=()=>new Promise(r=>setTimeout(r,0))}={}){
 const meshes=[];source.traverse(m=>{if(m.isSkinnedMesh)meshes.push(m);});
 for(const mesh of meshes){athleteGeometry(mesh);await yieldTask();}
}
