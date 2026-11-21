import {MeshBasicMaterial,DoubleSide} from 'three';

// Wider coverage geometry carries a 15cm logical line. Box-filter the TWO
// edges together so a subpixel distant line fades instead of becoming dashes.
// No fullscreen pass or MSAA framebuffer is required.
export function chalkCoverage(edge,span){
 const width=Math.max(.0001,span),lo=edge-width*.5,hi=edge+width*.5;
 return Math.max(0,Math.min(1,(Math.min(hi,.25)-Math.max(lo,-.25))/width));
}
export function createBroadcastChalk(){
 const material=new MeshBasicMaterial({color:0xf1f7ed,side:DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float chalkEdge; varying float vChalkEdge;').replace('#include <begin_vertex>','#include <begin_vertex>\nvChalkEdge = chalkEdge;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vChalkEdge;').replace('#include <color_fragment>',`#include <color_fragment>
   float chalkSpan = max(fwidth(vChalkEdge), 0.0001);
   float chalkLo = vChalkEdge - chalkSpan * 0.5;
   float chalkHi = vChalkEdge + chalkSpan * 0.5;
   float chalkAlpha = clamp((min(chalkHi, 0.25) - max(chalkLo, -0.25)) / chalkSpan, 0.0, 1.0);
   diffuseColor.a *= chalkAlpha;`);
 };
 material.customProgramCacheKey=()=> 'touchline-filtered-chalk-58';
 return material;
}
