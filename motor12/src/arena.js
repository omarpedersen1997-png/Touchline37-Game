import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {sharePlayerSkeletons, mergePlayerClothing} from '../../src/player-rendering.js';
import {FIELD, STEP, clamp} from './physics.js';

const {length: L, width: W, goal: G, bar: B}=FIELD;
const modelRoot=new URL('./arena/',import.meta.url);
const models=['player-auto.glb','keeper-auto.glb'];
const strips=['#357649','#3e8051'];

function makePitch(scene){
  const canvas=document.createElement('canvas');
  canvas.width=1024;canvas.height=664;
  const g=canvas.getContext('2d');
  g.scale(canvas.width/L,canvas.height/W);
  for(let i=0;i<14;i++){g.fillStyle=strips[i%2];g.fillRect(i*L/14,0,L/14,W);}
  let r=19;
  for(let i=0;i<10500;i++){
    r=(Math.imul(r,1664525)+1013904223)>>>0;
    const x=(r&65535)/65536*L,y=(r>>>16)/65536*W;
    g.fillStyle=i%2?'#eaf9c00b':'#152b1b0a';
    g.fillRect(x,y,.14,.05);
  }
  g.strokeStyle='#f8f9e4';g.fillStyle='#f8f9e4';g.lineWidth=.15;
  g.strokeRect(.12,.12,L-.24,W-.24);
  g.beginPath();g.moveTo(L/2,0);g.lineTo(L/2,W);g.stroke();
  g.beginPath();g.arc(L/2,W/2,FIELD.circle,0,Math.PI*2);g.stroke();
  for(const edge of [.18,L-.18]){
    const sign=edge<1?1:-1;
    g.strokeRect(edge,W/2-20.16,sign*16.5,40.32);
    g.strokeRect(edge,W/2-9.16,sign*5.5,18.32);
    g.beginPath();g.arc(edge+sign*11,W/2,.23,0,Math.PI*2);g.fill();
    const a=Math.acos(5.5/FIELD.circle);
    g.beginPath();g.arc(edge+sign*11,W/2,FIELD.circle,sign>0?-a:Math.PI-a,sign>0?a:Math.PI+a);g.stroke();
  }
  g.beginPath();g.arc(L/2,W/2,.24,0,Math.PI*2);g.fill();
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;
  const grass=new THREE.Mesh(new THREE.PlaneGeometry(L,W),new THREE.MeshStandardMaterial({map:texture,roughness:1}));
  grass.rotation.x=-Math.PI/2;grass.position.y=.018;scene.add(grass);
}
function stadium(scene){
  const box=new THREE.BoxGeometry(1,1,1);
  const concrete=new THREE.MeshStandardMaterial({color:0x726d74,roughness:.86});
  const metal=new THREE.MeshStandardMaterial({color:0x3c404b,roughness:.8});
  const track=new THREE.MeshStandardMaterial({color:0x3d4146,roughness:.9});
  const white=new THREE.MeshStandardMaterial({color:0xf2eee3,roughness:.48});
  function block(x,y,z,w,h,d,material){
    const mesh=new THREE.Mesh(box,material);
    mesh.position.set(x,y,z);mesh.scale.set(w,h,d);scene.add(mesh);
  }
  block(0,-.19,0,150,.35,107,track);
  const standRows=8,colours=[0xa52a32,0xe7e2d8,0x555464,0x254d78,0x33303a,0xd8b58d];
  const crowd=new THREE.InstancedMesh(box,new THREE.MeshLambertMaterial({color:0xffffff}),standRows*(106+2*55));
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  let seat=0;
  for(let row=0;row<standRows;row++){
    const y=.45+row*.66,z=-W/2-7-row*1.03;
    block(0,y*.5,z,123,y,1.14,concrete);
    for(let i=0;i<106;i++){
      const mix=(i*67+row*139)>>>0;
      dummy.position.set((i-52.5)*1.13,y+.43,z+.14);
      dummy.scale.set(.42+(mix%4)*.024,.66+(mix%5)*.036,.35);
      dummy.updateMatrix();
      crowd.setMatrixAt(seat,dummy.matrix);crowd.setColorAt(seat++,color.setHex(colours[mix%colours.length]));
    }
    for(const end of [-1,1]){
      const x=end*(L/2+8+row*1.03);
      block(x,y*.5,0,1.14,y,65,concrete);
      for(let i=0;i<55;i++){
        const mix=(i*79+row*137+end*19)>>>0;
        dummy.position.set(x,y+.41,(i-27)*1.14);
        dummy.scale.set(.34,.62+(mix%6)*.034,.44);
        dummy.updateMatrix();crowd.setMatrixAt(seat,dummy.matrix);
        crowd.setColorAt(seat++,color.setHex(colours[mix%colours.length]));
      }
    }
  }
  crowd.instanceMatrix.needsUpdate=true;scene.add(crowd);
  block(0,7.1,-W/2-15,126,.55,6.7,metal);
  for(const x of [-57,-29,0,29,57])block(x,3.7,-W/2-17,.35,7.5,.4,metal);
  const boards=new THREE.InstancedMesh(box,new THREE.MeshLambertMaterial({color:0xffffff}),34);
  for(let i=0;i<34;i++){
    const side=i<24;
    dummy.position.set(side?(i-11.5)*4.58:i<29?-L/2-4:L/2+4,.51,side?-W/2-2.4:(i%5-2)*12);
    dummy.scale.set(side?4.48:.21,1.02,side?.23:11.83);
    dummy.updateMatrix();boards.setMatrixAt(i,dummy.matrix);
    boards.setColorAt(i,color.setHex([0xb63830,0xf3e9d8,0x303248,0x375c83][i%4]));
  }
  scene.add(boards);
  for(const side of [-1,1]){
    const x=side*L/2,z=G/2;
    for(const end of [-z,z]){
      block(x,B/2,end,.13,B,.13,white);block(x+side*1.9,B/2,end,.065,B,.065,white);
      block(x+side*.95,B,end,1.9,.07,.08,white);
    }
    block(x,B,0,.13,.13,G,white);
    const segments=[];
    const add=(a,b,c,d,e,f)=>segments.push(a,b,c,d,e,f);
    for(let i=0;i<=22;i++){
      const lane=-z+i*G/22;
      add(x+side*1.9,0,lane,x+side*1.9,B,lane);
      add(x,B,lane,x+side*1.9,B,lane);
    }
    for(let i=0;i<=8;i++){
      const y=i*B/8;
      add(x+side*1.9,y,-z,x+side*1.9,y,z);
      add(x,y,z,x+side*1.9,y,z);
      add(x,y,-z,x+side*1.9,y,-z);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));
    scene.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xe8e4db,transparent:true,opacity:.52})));
  }
}
function actor(gltf, side, keeper) {
  const root=new THREE.Group(),figure=clone(gltf.scene);
  root.add(figure);
  const shirt=keeper?0xe1b653:side===0?0xb72c2d:0x405cc3;
  figure.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.frustumCulled=false;
    mesh.material=mesh.material.clone();
    const name=mesh.material.name;
    if(/Football Shirt|Football Socks/.test(name))mesh.material.color.setHex(shirt);
    if(/Football Shorts/.test(name))mesh.material.color.setHex(keeper?0x3c382d:side===0?0x641f28:0xdcdde2);
    mesh.material.roughness=.87;
  });
  sharePlayerSkeletons(figure);
  mergePlayerClothing(figure,gltf.scene,true);
  const mixer=new THREE.AnimationMixer(figure);
  const clips=new Map(gltf.animations.map(clip=>[clip.name,clip]));
  let playing='idle',move=mixer.clipAction(clips.get(playing)).play(),gesture=null,fading=false;
  return {root,mixer,act(p,seconds,release,fraction){
    const speed=Math.hypot(p.vx,p.vy);
    const next=speed>(playing==='run'?3.25:3.8)?'run':speed>.36?'walk':'idle';
    if(next!==playing){
      const before=move;
      move=mixer.clipAction(clips.get(next)).reset();
      if(playing!=='idle'&&next!=='idle')move.time=(before.time/before.getClip().duration%1)*move.getClip().duration;
      move.crossFadeFrom(before,.16,false).play();playing=next;
    }
    move.timeScale=playing==='run'?clamp(speed/3.55,.75,1.8):playing==='walk'?clamp(speed/1.42,.56,2):1;
    if(release&&clips.has(release)){
      gesture?.stop();
      gesture=mixer.clipAction(clips.get(release)).reset().setLoop(THREE.LoopOnce,1);
      gesture.time=gesture.getClip().duration*.35;gesture.fadeIn(.05).play();fading=false;
    }
    if(!fading&&gesture?.isRunning()&&gesture.time>gesture.getClip().duration*.66){gesture.fadeOut(.13);fading=true;}
    mixer.update(seconds*fraction);
  }};
}
function makeBall(scene){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
  const g=canvas.getContext('2d');
  g.fillStyle='#fffaf0';g.fillRect(0,0,128,64);
  g.fillStyle='#342b34';
  for(let i=0;i<12;i++){
    const x=i%6*24-2,y=i<6?19:46;
    g.beginPath();
    for(let j=0;j<5;j++)g.lineTo(x+Math.cos(j*2*Math.PI/5)*5,y+Math.sin(j*2*Math.PI/5)*5);
    g.closePath();g.fill();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),new THREE.MeshStandardMaterial({map,roughness:.58}));
  scene.add(ball);return ball;
}
export async function createArena(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  renderer.setClearColor(0x1c2235);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(44,1,.4,290);
  const actors=[],point=new THREE.Vector3(),follow=new THREE.Vector3(),eye=new THREE.Vector3(),look=new THREE.Vector3();
  const shadowMatrix=new THREE.Matrix4(),shadowPos=new THREE.Vector3(),shadowScale=new THREE.Vector3(),shadowRot=new THREE.Quaternion();
  let shadows,ball,ring,last=0,first=true,lastPhase='',lastView='',lastRelease='',oldX=0,oldY=0;
  const textureSet=new Set(),materialSet=new Set(),geometrySet=new Set(),skeletonSet=new Set();
  const dispose=()=>{
    scene.traverse(o=>{
      if(o.geometry)geometrySet.add(o.geometry);
      if(o.isSkinnedMesh)skeletonSet.add(o.skeleton);
      if(o.material){materialSet.add(o.material);if(o.material.map)textureSet.add(o.material.map);}
      if(o.isInstancedMesh)o.dispose();
    });
    for(const g of geometrySet)g.dispose();
    for(const s of skeletonSet)s.dispose();
    for(const m of materialSet)m.dispose();
    for(const t of textureSet)t.dispose();
    for(const a of actors)a.mixer.stopAllAction();
    renderer.dispose();
  };
  try{
    const loader=new GLTFLoader();
    const [outfield,keeper]=await Promise.all(models.map(name=>loader.loadAsync(new URL(name,modelRoot).href)));
    const fill=new THREE.HemisphereLight(0xfff3e4,0x819589,2.18);scene.add(fill);
    const key=new THREE.DirectionalLight(0xfff1db,2.5);key.position.set(-40,45,18);scene.add(key);
    makePitch(scene);stadium(scene);
    ball=makeBall(scene);
    ring=new THREE.Mesh(new THREE.RingGeometry(.55,.66,24),new THREE.MeshBasicMaterial({color:0xffefd1}));
    ring.rotation.x=-Math.PI/2;scene.add(ring);
    // The same transparent contact mesh is instanced for all 22 players and the ball.
    const shade=document.createElement('canvas');shade.width=shade.height=32;
    const sctx=shade.getContext('2d'),grad=sctx.createRadialGradient(16,16,2,16,16,16);
    grad.addColorStop(0,'#0b121580');grad.addColorStop(1,'#0b121500');
    sctx.fillStyle=grad;sctx.fillRect(0,0,32,32);
    shadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),
      new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shade),transparent:true,depthWrite:false}),23);
    shadows.frustumCulled=false;scene.add(shadows);
    for(let side=0;side<2;side++)for(let i=0;i<11;i++){
      const a=actor(i===0?keeper:outfield,side,i===0);
      scene.add(a.root);actors.push(a);
    }
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    return {dispose,mapAxes(input){
      const e=camera.matrixWorld.elements, x=input.x, y=input.y;
      const length=Math.hypot(e[0],e[2])||1;
      input.x=(x*e[0]-y*e[2])/length;
      input.y=(x*e[2]+y*e[0])/length;
    },layout(){
      const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return false;
      const pixel=Math.min(devicePixelRatio||1,1.18,Math.sqrt(1000000/(bounds.width*bounds.height)));
      renderer.setPixelRatio(pixel);renderer.setSize(bounds.width,bounds.height,false);
      camera.aspect=bounds.width/bounds.height;camera.updateProjectionMatrix();return true;
    },render(state,previous,alpha=1,running=false,view='tv',rate=1,slot=-1){
      const now=performance.now(),seconds=last?clamp((now-last)/1000,0,.05):0;
      last=now;
      const b=state.ball,snap=first||state.phase!==lastPhase,cut=snap||lastView!==view;
      const x=previous?THREE.MathUtils.lerp(previous[44],b.x,alpha):b.x;
      const y=previous?THREE.MathUtils.lerp(previous[45],b.y,alpha):b.y;
      const height=previous?THREE.MathUtils.lerp(previous[46],b.z,alpha):b.z;
      ball.position.set(x,Math.max(.22,height),y);
      if(!snap){ball.rotation.x+=(y-oldY)*4.5;ball.rotation.z-=(x-oldX)*4.5;}
      oldX=x;oldY=y;
      const kick=(b.kind==='pass'||b.kind==='shot')&&b.lastSlot>=0&&b.age<.13;
      const key=kick?b.lastTeam+':'+b.lastSlot+':'+Math.round(state.tick-b.age/STEP):'';
      let i=0;
      for(let side=0;side<2;side++)for(const p of state.teams[side].players){
        const a=actors[i],idx=i*2;
        a.root.visible=!p.red;
        if(!p.red){
          a.root.position.set(previous?THREE.MathUtils.lerp(previous[idx],p.x,alpha):p.x,0,
            previous?THREE.MathUtils.lerp(previous[idx+1],p.y,alpha):p.y);
          const turn=Math.atan2(p.fx,p.fy)-a.root.rotation.y;
          a.root.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*(snap?1:1-Math.exp(-seconds*17));
          a.act(p,running?seconds:0,key&&key!==lastRelease&&side===b.lastTeam&&p.slot===b.lastSlot
            ?b.kind==='shot'?'shoot':'pass':null,Math.min(2,rate));
        }
        shadowScale.set(p.red?0:1.2,1,p.red?0:.94);
        shadowPos.set(a.root.position.x+.08,.035,a.root.position.z+.12);
        shadowMatrix.compose(shadowPos,shadowRot,shadowScale);shadows.setMatrixAt(i++,shadowMatrix);
      }
      ring.visible=slot>=0||b.owner>=0;
      if(ring.visible){
        const carrier=actors[slot>=0?slot:(b.owner>>4)*11+b.owner%16].root.position;
        ring.position.set(carrier.x,.041,carrier.z);
      }
      if(key)lastRelease=key;
      shadowScale.setScalar(.45+Math.min(2,height)*.2);
      shadowPos.set(x,.038,y);shadowMatrix.compose(shadowPos,shadowRot,shadowScale);shadows.setMatrixAt(22,shadowMatrix);
      shadows.instanceMatrix.needsUpdate=true;
      const fit=Math.max(1,Math.sqrt(1.27/Math.max(.47,camera.aspect)));
      const restart=state.restart, close=view==='near'||!!restart;
      const centre=state.phase==='PRE_KICKOFF'||state.phase==='KICKOFF_READY';
      const direction=restart?state.teams[restart.side].direction:state.teams[b.lastTeam===1?1:0].direction;
      point.set(centre?0:clamp(x*.75+(motion.matches?0:b.vx*.07),-44,44),1,centre?0:clamp(y*.42,-23,23));
      if(close&&!centre&&!motion.matches){
        eye.set(x-direction*13*fit,7.8*fit,y+9*fit);
        point.set(clamp(x+direction*8,-52,52),.9,y);
      }else eye.set(point.x+9*fit,(centre?31:26)*fit,point.z+(centre?43:37)*fit);
      const mix=cut?1:1-Math.exp(-seconds*(motion.matches?3.8:6.5));
      camera.position.lerp(eye,mix);follow.lerp(point,mix);look.copy(follow);
      camera.lookAt(look);renderer.render(scene,camera);
      first=false;lastPhase=state.phase;lastView=view;
    }};
  }catch(error){dispose();throw error;}
}
