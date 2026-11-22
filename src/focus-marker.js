import {Matrix4,Vector3} from 'three';
// Called after the scene's ONE skeleton world update. Read cached matrices;
// never call getWorldPosition/updateWorldMatrix up the bone hierarchy again.
export function createFocusMarker(){
 const world=new Vector3(),local=new Vector3(),inverse=new Matrix4();
 return(model,marker)=>{
  const head=model?.userData.bones?.Head,label=model?.userData.label;if(!head||!label)return false;
  world.setFromMatrixPosition(head.matrixWorld);world.y+=.3;
  inverse.copy(model.matrixWorld).invert();local.copy(world).applyMatrix4(inverse);label.position.copy(local);label.updateMatrixWorld(true);
  marker.position.set(world.x,world.y+.2,world.z);marker.updateMatrixWorld(true);return true;
 };
}
