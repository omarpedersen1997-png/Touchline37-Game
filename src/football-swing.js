import{Quaternion,Vector3}from'three';
const worldAxes=[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)];
// Football actions layer onto the captured pose. Rest-space axes are immutable;
// calculate them once and reuse two quaternions instead of allocating per kick.
export function createFootballSwing(bones,base,parentRest){
 const axes=new Map(),delta=new Quaternion(),rotation=new Quaternion();
 for(const name of ['RightUpLeg','RightLeg','Spine2','LeftArm','RightArm']){
  if(!bones[name])continue;
  const inverse=parentRest.get(name)?.clone().invert()||new Quaternion();
  axes.set(name,worldAxes.map(axis=>axis.clone().applyQuaternion(inverse)));
 }
 return(name,x=0,y=0,z=0)=>{
  const bone=bones[name];if(!bone)return;
  let local=axes.get(name);
  if(!local){const inverse=parentRest.get(name)?.clone().invert()||new Quaternion();local=worldAxes.map(axis=>axis.clone().applyQuaternion(inverse));axes.set(name,local);}
  delta.identity();
  if(x)delta.multiply(rotation.setFromAxisAngle(local[0],x));
  if(y)delta.multiply(rotation.setFromAxisAngle(local[1],y));
  if(z)delta.multiply(rotation.setFromAxisAngle(local[2],z));
  bone.quaternion.copy(base.get(name)).premultiply(delta);
 };
}
