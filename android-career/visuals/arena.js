import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

async function openArena() {
  const canvas=document.querySelector('canvas');
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.13;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(38,1,.15,280);
  scene.background=new T.Color(0x273940);
  scene.fog=new T.FogExp2(0x344950,.006);
  const sky=new T.HemisphereLight(0xfff7df,0x64815b,1.8);
  scene.add(sky);
  const key=new T.DirectionalLight(0xfff0d6,2.75);
  key.position.set(-31,55,-23);key.castShadow=true;
  Object.assign(key.shadow.camera,{left:-70,right:70,top:65,bottom:-65,near:1,far:175});
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.045;key.shadow.radius=2;
  scene.add(key);
  const texture=new T.TextureLoader(), grass=texture.load('grass-color-1024.png');
  grass.colorSpace=T.SRGBColorSpace;grass.wrapS=grass.wrapT=T.RepeatWrapping;grass.repeat.set(9,6);grass.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const basic=(color)=>new T.MeshBasicMaterial({color});
  const lit=(color)=>new T.MeshStandardMaterial({color,roughness:.86});
  const box=new T.BoxGeometry(1,1,1);
  function block(x,y,z,width,height,depth,material) {
    const mesh=new T.Mesh(box,material);mesh.scale.set(width,height,depth);mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  const apron=lit(0x385a3a);block(0,-.26,0,130,.35,89,apron).receiveShadow=true;
  const surface=new T.PlaneGeometry(105,68,14,1).toNonIndexed();
  const colors=[];
  for(let i=0;i<surface.attributes.position.count;i++){
    const c=new T.Color(Math.floor(i/6)%2?0xf2f8df:0xe0ebc7);colors.push(c.r,c.g,c.b);
  }
  surface.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const field=new T.Mesh(surface,new T.MeshStandardMaterial({map:grass,vertexColors:true,roughness:1}));field.rotation.x=-Math.PI/2;field.receiveShadow=true;scene.add(field);
  const chalk=basic(0xf5f5dc), post=lit(0xf3f4ea);
  function line(x,z,u,v){const dx=u-x,dz=v-z;const m=block((x+u)/2,.017,(z+v)/2,Math.hypot(dx,dz),.018,.12,chalk);m.rotation.y=-Math.atan2(dz,dx);}
  function arc(x,z,r,start,end) {
    const m=new T.Mesh(new T.RingGeometry(r-.06,r+.06,64,1,start,end-start),chalk);
    m.rotation.x=-Math.PI/2;m.position.set(x,.028,z);scene.add(m);
  }
  line(0,-34,0,34);arc(0,0,9.15,0,Math.PI*2);
  const dot=new T.CircleGeometry(.14,12);
  for(const x of [-41.5,0,41.5]){const m=new T.Mesh(dot,chalk);m.rotation.x=-Math.PI/2;m.position.set(x,.04,0);scene.add(m);}
  const nets=[];
  const cord=new T.LineBasicMaterial({color:0xe8eee5,transparent:true,opacity:.72});
  for(const sign of [-1,1]){
    const x=sign*52.5;
    line(-52.5,sign*34,52.5,sign*34);line(x,-34,x,34);
    for(const [depth,w] of [[16.5,20.16],[5.5,9.16]]){
      line(x,-w,x-sign*depth,-w);line(x-sign*depth,-w,x-sign*depth,w);line(x-sign*depth,w,x,w);
    }
    arc(x-sign*11,0,9.15,sign<0?-.923:Math.PI-.923,sign<0?.923:Math.PI+.923);
    for(const side of [-1,1])block(x,1.22,side*3.66,.13,2.44,.13,post).castShadow=true;
    block(x,2.44,0,.13,.13,7.45,post);
    const points=[];
    function strand(a,b,steps){for(let i=0;i<steps;i++)for(const t of [i/steps,(i+1)/steps]){for(let k=0;k<3;k++)points.push(a[k]+(b[k]-a[k])*t);}}
    const back=x+2*sign;
    for(let i=0;i<=24;i++){const z=-3.66+7.32*i/24;strand([back,0,z],[back,2.44,z],10);strand([x,2.44,z],[back,2.44,z],7);}
    for(let j=0;j<=10;j++){const y=2.44*j/10;strand([back,y,-3.66],[back,y,3.66],24);for(const side of [-3.66,3.66])strand([x,y,side],[back,y,side],7);}
    for(let j=0;j<=7;j++){const gx=x+2*sign*j/7;strand([gx,2.44,-3.66],[gx,2.44,3.66],24);for(const side of [-3.66,3.66])strand([gx,0,side],[gx,2.44,side],10);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3).setUsage(T.DynamicDrawUsage));const mesh=new T.LineSegments(geo,cord);mesh.frustumCulled=false;scene.add(mesh);
    nets.push({attr:geo.attributes.position,base:new Float32Array(points),sign});
  }
  const crowd=texture.load('tribune.webp');crowd.colorSpace=T.SRGBColorSpace;crowd.wrapS=T.RepeatWrapping;crowd.repeat.x=3;
  const stands=new T.MeshBasicMaterial({map:crowd,side:T.DoubleSide});
  const ribbon=lit(0x174353), seat=lit(0x263b40), lamps=basic(0xfffbe0);
  for(const sign of [-1,1])for(const end of [false,true]){
    const width=end?88:124;
    const terrace=new T.Mesh(new T.PlaneGeometry(width,12),stands);
    terrace.rotation.y=end?-sign*Math.PI/2:sign<0?0:Math.PI;
    terrace.position.set(end?sign*62:0,6,end?0:sign*43);scene.add(terrace);
    block(end?sign*56:0,.6,end?0:sign*37,end?.22:111,1.2,end?73:.22,ribbon);
    block(end?sign*63:0,12,end?0:sign*44,end?3:125,.45,end?88:3,seat);
    for(let i=-2;i<=2;i++)block(end?sign*61:i*22,12.2,end?i*15:sign*42,end?.4:5,.3,end?4:.4,lamps);
  }
  const ball=new T.Mesh(new T.IcosahedronGeometry(.14,2),lit(0xfffae6));ball.castShadow=true;scene.add(ball);
  const patchGeometry=new T.CircleGeometry(.048,5),patchMat=basic(0x20282d);
  for(let i=0;i<12;i++){const p=new T.Mesh(patchGeometry,patchMat);const y=1-2*(i+.5)/12,r=Math.sqrt(1-y*y),a=i*2.4;p.position.set(r*Math.cos(a),y,r*Math.sin(a)).multiplyScalar(.138);p.lookAt(p.position.clone().multiplyScalar(2));ball.add(p);}
  const marker=new T.Mesh(new T.ConeGeometry(.19,.28,4),basic(0x43ffdf));marker.rotation.z=Math.PI;scene.add(marker);
  const load=new GLTFLoader();
  const [outfield,keeper]=await Promise.all(['player-auto.glb','keeper-auto.glb'].map(path=>load.loadAsync(path)));
  const agents=[],palette=new Map();
  for(let i=0;i<22;i++){
    const source=i%11===0?keeper:outfield, model=clone(source.scene), group=new T.Group();
    const bounds=new T.Box3().setFromObject(model), size=1.82/(bounds.max.y-bounds.min.y);
    model.scale.multiplyScalar(size);model.position.y-=bounds.min.y*size;
    model.traverse(node=>{if(!node.isMesh)return;node.castShadow=true;node.frustumCulled=false;
      const kit=i%11===0?'keeper':i<11?'home':'away';
      function cloth(mat){if(!/shirt|shorts|socks/i.test(mat.name))return mat;
        const id=kit+mat.uuid;if(!palette.has(id)){const copy=mat.clone();copy.color.set(kit==='keeper'?0xffb62c:kit==='home'?(/shorts/i.test(mat.name)?0x173048:0xf2eee3):(/shorts/i.test(mat.name)?0x192644:0x3359a0));palette.set(id,copy);}return palette.get(id);}
      node.material=Array.isArray(node.material)?node.material.map(cloth):cloth(node.material);
    });
    group.add(model);scene.add(group);const mixer=new T.AnimationMixer(model),actions={};
    for(const clip of source.animations)actions[clip.name]=mixer.clipAction(clip);
    actions.idle?.play();agents.push({group,mixer,actions,current:'idle'});
  }
  const target=new T.Vector3(),aim=new T.Vector3(),desired=new T.Vector3();
  let state=null,previous=0,age=9,impact=0,lastGoal=-1,net,hitY=0,hitZ=0,kx=0,ky=0,kz=0,vx=0,vy=0,vz=0,waiting=false,paused=false,frameId=0,tour=0;
  function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/Math.max(1,innerHeight);camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();camera.position.set(0,22,35);
  window.receiveArena=function(){waiting=false;state=arguments;};
  window.changeArena=function(){state=null;waiting=false;};
  function paint(now){
    if(paused)return;
    frameId=requestAnimationFrame(paint);
    const dt=previous?Math.min(.08,(now-previous)*.001):0;previous=now;
    if(!waiting && (!state || state[0]===1)){waiting=true;ArenaHost.frame();}
    if(!state)return;
    const match=state[0]===1;const gain=-Math.expm1(-5*dt);tour+=dt;
    let bx=0,by=.14,bz=0;
    if(match){
      bx=state[10]/1000;bz=state[11]/1000;by=state[12]/1000;
      if(lastGoal>=0 && lastGoal!==state[3] && state[3]>0){
        kx=state[4]/1000;kz=state[5]/1000;ky=state[6]/1000;vx=state[7]/1000;vz=state[8]/1000;vy=state[9]/1000;
        net=nets[kx>0?1:0];impact=2/Math.max(3,Math.abs(vx));hitY=T.MathUtils.clamp(ky+vy*impact-4.9*impact*impact,.14,2.4);hitZ=T.MathUtils.clamp(kz+vz*impact,-3.6,3.6);age=0;
      }
      lastGoal=state[3];age+=dt;
      if(!state[13])age=9;
      if(net && age<1.35){
        const t=Math.min(age,impact),w=Math.max(0,age-impact),bend=Math.min(.82,Math.abs(vx)*.035)*Math.sin(w*23)*Math.exp(-w*6);
        bx=kx+Math.sign(kx)*Math.min(2,Math.abs(vx)*t)+net.sign*bend;bz=T.MathUtils.clamp(kz+vz*t,-3.58,3.58);by=Math.max(.14,ky+vy*t-4.9*t*t-Math.max(0,w*w*3.3));
        for(let j=0;j<net.base.length;j+=3){const z=net.base[j+2]-hitZ,y=net.base[j+1]-hitY;const back=T.MathUtils.clamp((Math.abs(net.base[j])-52.5)*.5,0,1);net.attr.array[j]=net.base[j]+net.sign*bend*back*Math.exp(-.68*(z*z+y*y));}net.attr.needsUpdate=true;
      }else if(net){net.attr.array.set(net.base);net.attr.needsUpdate=true;net=null;}
      const focus=state[1]===1?15+state[2]*8:-1;
      const tx=focus>=0?(bx+state[focus]/1000)/2:bx,tz=focus>=0?(bz+state[focus+1]/1000)/2:bz;
      if(state[1]===2){target.set(0,0,0);desired.set(0,76,34);}
      else if(state[1]===3){const side=bx<0?-1:1;target.set(bx,1,bz);desired.set(bx-side*18,8,bz+5);}
      else {target.set(tx,1.55,tz);desired.set(tx-1,focus>=0?8.2:12.4,tz+(focus>=0?16:26));}
    } else {
      lastGoal=-1;age=9;const mode=state[0];
      target.set(mode===8?12:0,1,0);desired.set(-26+mode*4+Math.sin(tour*.08)*8,9+mode,29+Math.cos(tour*.08)*4);
    }
    for(let i=0;i<agents.length;i++){
      const a=agents[i], k=15+8*i;let name='idle';
      if(match && net && age<1.35){a.mixer.update(dt);continue;}
      if(match){a.group.position.set(state[k]/1000,0,state[k+1]/1000);a.group.rotation.y=Math.PI/2-state[k+2]/1000;
        name=state[k+6]>0?'dive':state[k+5]>260?'shoot':state[k+4]>0?'sprint':state[k+3]>2700?'run':state[k+3]>300?'walk':'idle';}
      else {const k=1+2*i;a.group.position.set(state[k]/1000,0,state[k+1]/1000);a.group.rotation.y=(i<11?1:-1)*Math.PI/2;}
      if(name!==a.current && a.actions[name]){const old=a.actions[a.current];a.actions[name].reset().fadeIn(.12).play();old?.fadeOut(.12);a.current=name;}
      a.mixer.update(dt);
    }
    ball.rotation.x+=(bz-ball.position.z)*6;ball.rotation.z-=(bx-ball.position.x)*6;ball.position.set(bx,Math.max(.14,by),bz);
    marker.visible=match && Boolean(state[14]);if(marker.visible){marker.position.copy(agents[state[2]].group.position);marker.position.y=2.18;}
    camera.position.lerp(desired,gain);aim.lerp(target,gain);camera.lookAt(aim);renderer.render(scene,camera);
  }
  window.restArena=function(rest){cancelAnimationFrame(frameId);paused=rest;waiting=false;previous=0;if(!rest)frameId=requestAnimationFrame(paint);};
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();window.restArena(true);ArenaHost.failed();});
  canvas.addEventListener('webglcontextrestored',()=>window.restArena(false));
  addEventListener('pagehide',()=>{
    window.restArena(true);
    const resources=new Set();
    scene.traverse(node=>{if(node.geometry)resources.add(node.geometry);if(node.material)for(const material of [].concat(node.material)){
      resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
    }});
    for(const agent of agents){agent.mixer.stopAllAction();agent.mixer.uncacheRoot(agent.mixer.getRoot());}
    resources.forEach(resource=>resource.dispose());renderer.dispose();
  },{once:true});
  window.restArena(false);
}
openArena().catch(error=>{console.error(error);ArenaHost.failed();});
