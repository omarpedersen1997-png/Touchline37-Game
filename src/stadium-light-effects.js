import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide, Sprite, SpriteMaterial } from 'three';
import { contactShadowTexture } from './contact-shadow.js';

export function createStadiumBeams(lamps) {
 const positions=[],colours=[];
 for(const {x,z} of lamps){
  const length=Math.hypot(x,z),crossX=z/length,crossZ=-x/length;
  const near=[x*.97,21.9,z*.97];
  const middle=[x*.67,9,z*.67],end=[x*.41,.09,z*.41];
  const edge=(point,width)=>[
   [point[0]-crossX*width,point[1],point[2]-crossZ*width],
   [point[0]+crossX*width,point[1],point[2]+crossZ*width],
  ];
  const [left,right]=edge(near,1.4),[midLeft,midRight]=edge(middle,4.1),[endLeft,endRight]=edge(end,7);
  for(const [point,alpha] of [
   [left,.08],[midLeft,.035],[midRight,.035],[left,.08],[midRight,.035],[right,.08],
   [midLeft,.035],[endLeft,0],[endRight,0],[midLeft,.035],[endRight,0],[midRight,.035],
  ]){
   positions.push(...point);colours.push(.72,.86,1,alpha);
  }
 }
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new Float32BufferAttribute(colours,4));
 const material=new MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:DoubleSide,forceSinglePass:true});
 const mesh=new Mesh(geometry,material);
 mesh.name='Soft stadium floodlight beams';
 mesh.renderOrder=3;
 return mesh;
}

export function createWoodworkGlint(scene,field) {
 const sprite=new Sprite(new SpriteMaterial({map:contactShadowTexture(),color:0xffdf9b,transparent:true,opacity:0,depthWrite:false}));
 sprite.visible=false;
 scene.add(sprite);
 let hitTick=-1;
 return (state,subtick,reducedMotion)=>{
  const action=state.lastAction;
  const age=action?.kind==='woodwork'?state.tick-action.tick+subtick:Infinity;
  if(reducedMotion||state.replayHold||age<0||age>=4){sprite.visible=false;hitTick=-1;return;}
  if(hitTick!==action.tick){
   hitTick=action.tick;
   const {x,y,z}=state.ball,half=field.goalWidth*.5;
   const postDistance=Math.abs(Math.abs(x)-half),barDistance=Math.abs(z-field.goalHeight);
   const atBar=barDistance<postDistance;
   sprite.position.set(atBar?Math.max(-half,Math.min(half,x)):Math.sign(x||1)*half,atBar?field.goalHeight:Math.max(.18,Math.min(field.goalHeight,z)),Math.sign(y||1)*field.length*.5);
  }
  sprite.visible=true;
  sprite.material.opacity=.72*(1-age*.25)**2;
  sprite.scale.setScalar(.65+age*.22);
 };
}
