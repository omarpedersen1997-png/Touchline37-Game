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

export function pitchFloodlightRows(x,z,field){
 const side=Math.min(1,Math.abs(x)/(field.width*.5));
 const end=Math.min(1,Math.abs(z)/(field.length*.5));
 // Static pools roll into a quiet edge falloff. All lighting is baked into
 // the existing vertex colour buffer, including on the Auto quality mode.
 const pool=Math.exp(-((end-.59)**2)*11)*Math.exp(-((side-.42)**2)*4);
 return .9+pool*.16-(side**3)*.085-(end**3)*.05;
}

export function createBroadcastPitch(field,textures,lighting=MATCH_LIGHTING){
 const geometry=new THREE.PlaneGeometry(field.width,field.length,Math.ceil(field.width/2),Math.ceil(field.length/2));
 const position=geometry.attributes.position,colours=new Float32Array(position.count*3);
 const light=new THREE.Color(lighting.pitchLight),dark=new THREE.Color(lighting.pitchDark),wear=new THREE.Color(0xb5ac78),colour=new THREE.Color();
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),z=-position.getY(i),surface=pitchSurfaceSample(x,z,field);
  const lightPool=lighting===MATCH_LIGHTING?1:pitchFloodlightRows(x,z,field);
  colour.copy(dark).lerp(light,surface.band).multiplyScalar(surface.variation*lightPool).lerp(wear,surface.wear);
  colour.toArray(colours,i*3);
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));
 const map=name=>{const source=textures[name];if(!source)return null;const t=source.clone();t.repeat.set(field.width/6,field.length/6);t.needsUpdate=true;return t;};
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,
  map:map('color'),normalMap:map('normal'),roughnessMap:map('roughness'),normalScale:new THREE.Vector2(.2,.2)});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='R3 continuous broadcast grass';mesh.rotation.x=-Math.PI/2;mesh.position.y=.03;mesh.receiveShadow=true;
 return mesh;
}
