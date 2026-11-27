// Offline art tooling. Only the resulting bitmap is included in the Android package.
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
window.bake = async () => {
  const cell=80, poses=[['idle',0],...Array.from({length:6},(_,i)=>['run',i/6]),['shoot',.48]];
  const atlas=document.createElement('canvas');
  atlas.width=8*cell;atlas.height=poses.length*cell*3;
  const out=atlas.getContext('2d');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(cell,cell,false);renderer.setClearColor(0,0);
  const scene=new T.Scene();
  scene.add(new T.HemisphereLight(0xfff3da,0xb6c5ae,2));
  const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(-3,6,4);scene.add(light);
  for(let team=0;team<3;team++){
    const model=await new GLTFLoader().loadAsync('/'+(team===2?'keeper':'player')+'-auto.glb');
    const modelRoot=model.scene;scene.add(modelRoot);
    const box=new T.Box3().setFromObject(modelRoot),height=box.max.y-box.min.y;
    const camera=new T.OrthographicCamera(-height*.57,height*.57,height*.57,-height*.57,.01,height*12);
    camera.position.set(0,box.min.y+height*.95,height*4);
    camera.lookAt(0,box.min.y+height*.5,0);
    modelRoot.traverse(o=>{
      if(!o.isMesh)return;
      const m=o.material;
      if(/Football Shirt|Football Socks/.test(m.name))m.color.setHex([0xdc393d,0xeeeeee,0xecb83c][team]);
      if(/Football Shorts/.test(m.name))m.color.setHex([0x66232d,0x274783,0x393f37][team]);
    });
    const mixer=new T.AnimationMixer(modelRoot);
    poses.forEach(([name,phase],row)=>{
      mixer.stopAllAction();
      const clip=T.AnimationClip.findByName(model.animations,name);
      mixer.clipAction(clip).play();mixer.setTime(clip.duration*phase);
      for(let face=0;face<8;face++){
        modelRoot.rotation.y=face*Math.PI/4;
        renderer.render(scene,camera);
        out.drawImage(renderer.domElement,face*cell,(team*poses.length+row)*cell);
      }
    });
    scene.remove(modelRoot);
  }
  return atlas.toDataURL('image/png').split(',')[1];
};
