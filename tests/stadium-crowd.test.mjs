import{test}from'node:test';
import assert from'node:assert/strict';
import * as THREE from'three';
import{buildStadiumCrowd}from'../src/stadium-crowd.js';

function canvasFixture(){
 const previous=globalThis.document,inks=new Set(),calls=[];
 const context=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:(_,key,value)=>{if(key==='fillStyle')inks.add(value);return true;}});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
 return{inks,calls,restore(){globalThis.document=previous;}};
}
function crowdSeats(){
 const points=[],w=30,l=48;
 for(const side of[-1,1])for(let tier=0;tier<2;tier++)for(let row=0;row<10;row++){
  const depth=8+tier*10+row*.9,y=.5+tier*8+row*.65;
  for(let along=-(96+14)/2;along<(96+14)/2;along+=1.5)if(!(tier===0&&row<5&&Math.abs(along)<3))points.push([side*(w+depth),y+.45,along]);
  for(let across=-(60+13)/2;across<(60+13)/2;across+=1.5)if(!(tier===0&&row<4&&Math.abs(across)<2))points.push([across,y+.45,side*(l+depth)]);
 }
 return points;
}

test('4864 seated spectators retain adult placement and textured detail within four batches and four triangles per person',()=>{
 const fixture=canvasFixture();try{
  const points=crowdSeats();assert.equal(points.length,4864);const scene=new THREE.Scene(),crowd=buildStadiumCrowd(scene,points,'sharp'),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  assert.equal(crowd.batches.length,4);assert.equal(new Set(crowd.batches.map(b=>b.material)).size,1);assert.equal(crowd.batches.reduce((sum,b)=>sum+b.count,0),4864);
  const triangles=crowd.batches.reduce((sum,b)=>sum+b.count*b.geometry.index.count/3,0);assert.equal(triangles,19456);assert(triangles<4864*86*.05,'under five percent of the previous audience triangle budget');
  const variants=new Set();
  for(const mesh of crowd.batches){
   assert(mesh.isInstancedMesh);assert(!mesh.castShadow&&!mesh.receiveShadow);assert(mesh.boundingBox&&mesh.boundingSphere);assert.equal(mesh.geometry.index.count,12);
   for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);assert(position.toArray().every(Number.isFinite));assert(scale.y>=.95&&scale.y<=1.09);
    const original=points.find(p=>Math.abs(p[0]-position.x)<1e-4&&Math.abs(p[1]+.44-position.y)<1e-4&&Math.abs(p[2]-position.z)<1e-4);assert(original,'one actual seat for each instance');
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(rotation),inward=new THREE.Vector3(-position.x,0,-position.z).normalize();assert(normal.dot(inward)>.999);
    const tile=mesh.geometry.attributes.crowdTile;variants.add(tile.getX(i)+':'+tile.getY(i));assert(tile.getX(i)>=0&&tile.getX(i)<1&&tile.getY(i)>=0&&tile.getY(i)<1);
   }
  }
  assert.equal(variants.size,32);assert.equal(crowd.texture.image.width,1024);assert.equal(crowd.texture.image.height,512);assert.equal(crowd.texture.colorSpace,THREE.SRGBColorSpace);assert(fixture.inks.size>=16,'separate clothes, skin, hair, face and fold inks');assert(fixture.calls.some(c=>c[0]==='ellipse'),'painted head silhouettes');assert(fixture.calls.some(c=>c[0]==='stroke'),'collar/scarf detail');assert(crowd.material.alphaTest>0);assert.equal(crowd.material.transparent,false);assert.equal(crowd.material.side,THREE.DoubleSide);
  crowd.dispose();assert.equal(scene.children.length,0);
 }finally{fixture.restore();}
});

test('cutaway skips whole camera-side audience batches before submitting vertices and preserves instance data',()=>{
 const fixture=canvasFixture();try{const scene=new THREE.Scene(),crowd=buildStadiumCrowd(scene,crowdSeats(),'sharp'),eye=new THREE.Vector3(),target=new THREE.Vector3(0,.8,0),versions=crowd.batches.map(b=>b.instanceMatrix.version);
  for(const[x,z]of[[25,3],[-25,3],[25,-3],[-25,-3]]){
   eye.set(x,15,z);crowd.setCameraView(eye,target);const visible=crowd.batches.filter(b=>b.visible);assert(visible.length>0&&visible.length<=2);assert(visible.reduce((n,b)=>n+b.count*4,0)<19456*.6);
   for(const mesh of visible){assert(mesh.userData.crowd.stand!==('x'+(x>0?'+':'-')));assert(mesh.userData.crowd.stand!==('z'+(z>0?'+':'-')));}
  }
  crowd.setCameraView(new THREE.Vector3(0,50,0),target);assert(crowd.batches.every(b=>b.visible),'top-down camera does not hide arbitrary stands');assert.deepEqual(crowd.batches.map(b=>b.instanceMatrix.version),versions,'camera movement does not upload crowd matrices again');crowd.dispose();
 }finally{fixture.restore();}
});

test('atlas UV selection is per-instance while the normal Three map and clipping shader paths remain available',()=>{
 const fixture=canvasFixture();try{const scene=new THREE.Scene(),crowd=buildStadiumCrowd(scene,[[38,.95,0],[-38,.95,0],[0,.95,56],[0,.95,-56]],'auto'),shader={vertexShader:'#include <common>\n#include <uv_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>\n#include <clipping_planes_fragment>'};
  crowd.material.onBeforeCompile(shader);assert(shader.vertexShader.includes('attribute vec2 crowdTile'));assert(shader.vertexShader.includes('vCrowdTile=crowdTile'));assert(shader.fragmentShader.includes('vec2 crowdUv='));assert(shader.fragmentShader.includes('texture2D( map, crowdUv )'));assert(shader.fragmentShader.includes('#include <clipping_planes_fragment>'));assert.equal(crowd.material.customProgramCacheKey(),'touchline-spectator-atlas-v1');crowd.dispose();
 }finally{fixture.restore();}
});
