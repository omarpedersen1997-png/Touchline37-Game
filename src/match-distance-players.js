import {
  CapsuleGeometry, Color, DynamicDrawUsage, InstancedMesh, Matrix4,
  MeshLambertMaterial, Quaternion, Vector3,
} from 'three';
import {createPlayerStride,JOINT as J,samplePlayerStride} from './player-stride-pose.js';

export const DISTANCE_PLAYER_PARTS = 15;
const SKIN = [0xc69075,0x895b43,0xd8a180,0x6d4935];

export function createDistancePlayers(scene, count, home, away) {
  const geometry = new CapsuleGeometry(.5, 1, 2, 6);
  const material = new MeshLambertMaterial({color:0xffffff});
  const mesh = new InstancedMesh(geometry, material, count*2*DISTANCE_PLAYER_PARTS);
  mesh.name = 'Articulated distant footballers';
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  scene.add(mesh);

  const slots=Array.from({length:count*2},(_,i)=>createPlayerStride(i+1));
  const owners=new Int16Array(count*2).fill(-1);
  const root=new Matrix4(),part=new Matrix4(),world=new Matrix4();
  const point=new Vector3(),scale=new Vector3(),rotation=new Quaternion(),direction=new Vector3(),up=new Vector3(0,1,0);
  const palettes=slots.map((_,i)=>{
    const keeper=i%count===0,shirt=keeper?(i<count?'#e5c254':'#8faabd'):(i<count?home:away);
    const skin=SKIN[i%SKIN.length];
    return [0x20262b,shirt,skin,skin,shirt,skin,shirt,skin,0x20262b,0xe5e7dd,0x20262b,0xe5e7dd,0x142222,0x142222,0x282322].map(color=>new Color(color));
  });
  mesh.setColorAt(0,palettes[0][0]);mesh.instanceColor.setUsage(DynamicDrawUsage);
  let visibleCount=0,changedPalette=false,offset=0;
  mesh.count=0;

  function place(j,id,index,sx,sy,sz,dy=0,dz=0) {
    point.set(j[id],j[id+1]+dy,j[id+2]+dz);scale.set(sx,sy,sz);rotation.identity();
    write(index);
  }
  function bone(j,a,b,index,width,depth,overhang=0) {
    direction.set(j[b]-j[a],j[b+1]-j[a+1],j[b+2]-j[a+2]);
    const length=direction.length()||1;
    rotation.setFromUnitVectors(up,direction.multiplyScalar(1/length));
    point.set((j[a]+j[b])*.5,(j[a+1]+j[b+1])*.5,(j[a+2]+j[b+2])*.5);
    scale.set(width,(length+overhang)*.5,depth);
    write(index);
  }
  function write(index) {
    part.compose(point,rotation,scale);
    mesh.setMatrixAt(offset+index,world.multiplyMatrices(root,part));
  }
  return {
    mesh,
    draw(slot,player,model,elapsed,visible,subtick=0,snap=false) {
      const state=slots[slot];
      if(!visible){state.previousX=NaN;return null;}
      const {x,z}=model.position,heading=model.rotation.y;
      const j=samplePlayerStride(state,player,x,z,heading,elapsed,subtick,snap);
      offset=visibleCount*DISTANCE_PLAYER_PARTS;
      if(owners[visibleCount]!==slot){
        owners[visibleCount]=slot;
        for(let i=0;i<DISTANCE_PLAYER_PARTS;i++)mesh.setColorAt(offset+i,palettes[slot][i]);
        changedPalette=true;
      }
      visibleCount++;
      root.makeRotationY(heading);root.setPosition(x,.035,z);
      place(j,J.pelvis,0,.324,.117,.221,-.044);
      bone(j,J.pelvis,J.neck,1,.375,.238,.115);
      bone(j,J.neck,J.head,2,.101,.104,.037);
      place(j,J.head,3,.154,.113,.161);
      place(j,J.head,14,.160,.066,.159,.064,-.006);
      for(let side=0;side<2;side++){
        const arm=J.shoulderL+side*9,leg=J.hipL+side*12;
        bone(j,arm,arm+3,4+side*2,.127,.125,.060);
        bone(j,arm+3,arm+6,5+side*2,.095,.092,.056);
        bone(j,leg,leg+3,8+side*2,.177,.162,.079);
        bone(j,leg+3,leg+6,9+side*2,.128,.117,.055);
        place(j,leg+9,12+side,.127,.054,.235);
      }
      return state;
    },
    finish() {
      mesh.count=visibleCount*DISTANCE_PLAYER_PARTS;
      if(visibleCount)mesh.instanceMatrix.needsUpdate=true;
      if(changedPalette)mesh.instanceColor.needsUpdate=true;
      visibleCount=0;changedPalette=false;
    },
  };
}

export function keepDetailedPlayer(player, focused, inView, tactical, closeDistance, wasDetailed) {
  if(!inView)return false;
  if(focused||player.dive>0)return true;
  if(tactical)return false;
  return closeDistance<(wasDetailed?92:62)||(player.kick>0&&closeDistance<145);
}
