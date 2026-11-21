import * as THREE from 'three';

const soleCache=new WeakMap();
// Select support vertices once, while the original shoe meshes still exist.
// Animation then transforms this small fixed set, never scans skinned geometry.
function soleSupports(human,source){
 let supports=soleCache.get(source);if(supports)return supports;
 const candidates=[[],[]],point=new THREE.Vector3(),bindPoint=new THREE.Vector3();
 human.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh.material?.name!=='Sneaker outsole')return;
  const{position,skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++){
   mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
   const influences=[];bindPoint.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix);
   for(let j=0;j<4;j++){
    const weight=skinWeight.getComponent(i,j);if(!weight)continue;
    const index=skinIndex.getComponent(i,j);
    influences.push({name:mesh.skeleton.bones[index].name,weight,point:bindPoint.clone().applyMatrix4(mesh.skeleton.boneInverses[index])});
   }
   candidates[point.x<0?0:1].push({point:point.clone(),influences});
  }
 });
 supports=[];
 for(const foot of candidates){
  const selected=new Set();
  // The outsole's directional extremes cover heel, toe and both edges when a
  // boot rolls. Skin weights preserve toe articulation in the support points.
  for(let x=-1;x<=1;x++)for(let y=0;y<=1;y++)for(let z=-1;z<=1;z++){
   if(!x&&!y&&!z)continue;let best=null,score=Infinity;
   for(const vertex of foot){const value=vertex.point.x*x+vertex.point.y*y+vertex.point.z*z;if(value<score){score=value;best=vertex;}}
   if(best)selected.add(best);
  }
  for(const vertex of selected)supports.push(vertex.influences);
 }
 soleCache.set(source,supports);return supports;
}

export function createPlayerGrounding(human,source){
 const supports=soleSupports(human,source),bones={};human.traverse(node=>{if(node.isBone)bones[node.name]=node;});
 const records=[],byNode=new Map(),byName={};
 function record(node){
  if(!node||node===human)return null;if(byNode.has(node))return byNode.get(node);
  const parent=record(node.parent),value={node,parent,matrix:new THREE.Matrix4()};byNode.set(node,value);records.push(value);return value;
 }
 for(const support of supports)for(const influence of support)if(!byName[influence.name])byName[influence.name]=record(bones[influence.name]);
 const position=new THREE.Vector3(),weighted=new THREE.Vector3();
 return{
  supportCount:supports.length,
  apply(floor=.035){
   if(!supports.length)return;
   for(const entry of records){entry.node.updateMatrix();if(entry.parent)entry.matrix.multiplyMatrices(entry.parent.matrix,entry.node.matrix);else entry.matrix.copy(entry.node.matrix);}
   let lowest=Infinity;
   for(const support of supports){
    weighted.set(0,0,0);
    for(const influence of support){position.copy(influence.point).applyMatrix4(byName[influence.name].matrix);weighted.addScaledVector(position,influence.weight);}
    weighted.multiply(human.scale).applyQuaternion(human.quaternion);
    lowest=Math.min(lowest,weighted.y);
   }
   human.position.y=floor-lowest;
  }
 };
}
