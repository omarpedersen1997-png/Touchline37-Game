import {
  CapsuleGeometry, Color, DynamicDrawUsage, Euler, InstancedMesh, Matrix4,
  MeshLambertMaterial, Quaternion, Vector3,
} from 'three';

const PARTS = 12;
const SKIN = [0xc69075,0x895b43,0xd8a180,0x6d4935];

export function createDistancePlayers(scene, count, home, away) {
  const geometry = new CapsuleGeometry(.5, 1, 2, 6);
  const material = new MeshLambertMaterial({color:0xffffff});
  const mesh = new InstancedMesh(geometry, material, count*2*PARTS);
  mesh.name = 'Animated distant footballers';
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  scene.add(mesh);

  const colour = new Color(), hidden = new Matrix4().makeScale(0,0,0);
  const active = new Uint8Array(count*2), strides = new Float32Array(count*2);
  const root = new Matrix4(), part = new Matrix4(), world = new Matrix4();
  const position = new Vector3(), scale = new Vector3(), rotation = new Quaternion(), euler = new Euler();
  for (let i=0;i<count*2;i++) {
    const keeper=(i%count)===0;
    const shirt=keeper?(i<count?'#e5c254':'#8faabd'):(i<count?home:away);
    const tone=SKIN[i%SKIN.length];
    const uniform=[shirt,tone,'#20262b',shirt,shirt,tone,tone,0xe5e7dd,0xe5e7dd,0x172222,0x172222,0x172222];
    for (let n=0;n<PARTS;n++) {
      mesh.setColorAt(i*PARTS+n,colour.set(uniform[n]));
      mesh.setMatrixAt(i*PARTS+n,hidden);
    }
    strides[i]=i*1.3;
  }
  let dirty=true;
  const place=(slot,offset,x,y,z,sx,sy,sz,rx=0,rz=0)=>{
    position.set(x,y,z);scale.set(sx,sy,sz);
    rotation.setFromEuler(euler.set(rx,0,rz));
    part.compose(position,rotation,scale);
    mesh.setMatrixAt(slot*PARTS+offset,world.multiplyMatrices(root,part));
  };
  return {
    mesh,
    draw(slot, player, model, elapsed, visible) {
      if (!visible) {
        if (active[slot]) {
          for(let i=0;i<PARTS;i++)mesh.setMatrixAt(slot*PARTS+i,hidden);
          active[slot]=0;
          dirty=true;
        }
        return;
      }
      active[slot]=1;
      dirty=true;
      const speed=Math.hypot(player.vx,player.vy);
      strides[slot]=(strides[slot]+speed*elapsed*2.6)%(Math.PI*2);
      const gait=Math.sin(strides[slot])*Math.min(.62,speed*.095);
      const action=player.kick>0?Math.sin(Math.min(1,player.kick/10)*Math.PI)*.64:0;
      const torsoLean=Math.min(.16,speed*.017)+(player.tackle>0?.24:0);
      root.makeRotationY(model.rotation.y);
      root.setPosition(model.position.x,0,model.position.z);
      place(slot,0,0,1.32,0,.55,.37,.32,torsoLean);
      place(slot,1,0,1.95,.025,.30,.167,.29);
      place(slot,2,0,.96,0,.48,.15,.29);
      place(slot,11,0,2.04,.012,.303,.11,.292);
      for(let side=0;side<2;side++){
        const f=side*2-1,swing=gait*f+(side===1?action:0),lift=Math.abs(swing)*.13;
        place(slot,3+side,f*.32,1.37,0,.17,.22,.17,-swing*.6,f*.16);
        place(slot,5+side,f*.37,1.10,swing*-.12,.125,.18,.128,-swing*.65,f*.10);
        place(slot,7+side,f*.15,.49+lift,swing*.15,.19,.36,.19,swing);
        place(slot,9+side,f*.15,.10+lift,swing*.34+.08,.187,.094,.31,swing*.5);
      }
    },
    finish() {
      if(dirty){mesh.instanceMatrix.needsUpdate=true;dirty=false;}
    },
  };
}

export function keepDetailedPlayer(player, focused, inView, tactical, closeDistance, wasDetailed) {
  if(!inView)return false;
  if(focused||player.dive>0)return true;
  if(tactical)return false;
  return closeDistance<(wasDetailed?92:62)||(player.kick>0&&closeDistance<145);
}
