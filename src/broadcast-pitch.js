import * as THREE from 'three';
import {MATCH_LIGHTING} from './match-lighting.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

// Metres, static and deterministic. Macro variation survives texture mipmaps;
// blade detail stays in the existing local normal/roughness/colour maps.
export function pitchSurfaceSample(x,z,field){
 const band=smooth(-.35,.35,Math.cos(z*Math.PI/8));
 const variation=1+.035*Math.sin(x*.39+z*.17)+.022*Math.cos(z*.51-x*.21);
 const goalDistance=Math.min((z-field.length/2)**2,(z+field.length/2)**2);
 const goalWear=Math.exp(-x*x/24-goalDistance/11)*.14;
 const centreWear=Math.exp(-(x*x+z*z)/40)*.055;
 return {band,variation,wear:Math.min(.18,goalWear+centreWear)};
}

export function createBroadcastPitch(field,textures){
 const geometry=new THREE.PlaneGeometry(field.width,field.length,Math.ceil(field.width/2),Math.ceil(field.length/2));
 const position=geometry.attributes.position,colours=new Float32Array(position.count*3);
 const light=new THREE.Color(MATCH_LIGHTING.pitchLight),dark=new THREE.Color(MATCH_LIGHTING.pitchDark),wear=new THREE.Color(0xb5ac78),colour=new THREE.Color();
 for(let i=0;i<position.count;i++){
  const surface=pitchSurfaceSample(position.getX(i),-position.getY(i),field);
  colour.copy(dark).lerp(light,surface.band).multiplyScalar(surface.variation).lerp(wear,surface.wear);
  colour.toArray(colours,i*3);
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));
 const map=name=>{const source=textures[name];if(!source)return null;const t=source.clone();t.repeat.set(field.width/6,field.length/6);t.needsUpdate=true;return t;};
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,
  map:map('color'),normalMap:map('normal'),roughnessMap:map('roughness'),normalScale:new THREE.Vector2(.2,.2)});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='R3 continuous broadcast grass';mesh.rotation.x=-Math.PI/2;mesh.position.y=.03;mesh.receiveShadow=true;
 return mesh;
}
