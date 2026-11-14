import * as THREE from 'three';

// Keep material colour spaces and UVs intact. Anisotropic mip filtering retains
// surface detail at the shallow angles of the TV camera without nearest-pixel
// shimmer or an artificial sharpening halo.
export function configureMatchTextures(root,maximum=1){
 const anisotropy=Math.max(1,Math.min(16,Number.isFinite(maximum)?maximum:1)),textures=new Set();
 root.traverse(o=>{for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const value of Object.values(material))if(value?.isTexture&&!value.isCubeTexture&&!value.isRenderTargetTexture&&!value.isVideoTexture)textures.add(value);});
 for(const texture of textures){
  if(texture.anisotropy===anisotropy&&texture.magFilter===THREE.LinearFilter&&texture.minFilter===THREE.LinearMipmapLinearFilter&&texture.generateMipmaps)continue;
  texture.anisotropy=anisotropy;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 }
 return textures.size;
}
