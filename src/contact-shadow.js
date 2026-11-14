import * as THREE from 'three';

export function contactShadowTexture(){
 const size=32,rgba=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2)),i=(y*size+x)*4;
  rgba[i]=rgba[i+1]=rgba[i+2]=255;rgba[i+3]=Math.round(Math.max(0,1-r*r)**2*255);
 }
 const texture=new THREE.DataTexture(rgba,size,size);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
