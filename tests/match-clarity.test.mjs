import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {matchResolution,createAutoResolutionController} from '../src/match-quality.js';
import {readMatchPreferences,saveMatchPreferences} from '../src/manual-preferences.js';
import {configureMatchTextures} from '../src/match-textures.js';

test('Sharp uses native phone density rather than the previous 2x cap and supersamples low-DPR views',()=>{
 for(const [width,height,dpr]of[[900,400,2.625],[800,360,3],[1280,576,1],[1920,1080,1]]){
  const p=matchResolution({width,height,dpr,quality:'sharp',scale:.01}),expected=Math.min(3840,Math.max(width,height)*Math.max(dpr,1920/Math.max(width,height)));
  assert(Math.abs(Math.max(p.width,p.height)-expected)<=1);assert(Math.abs(p.width/p.height-width/height)<.004);assert.equal(p.is4k,false,'Sharp is labelled separately even when it reaches 3840');
 }
 const native=matchResolution({width:900,height:400,dpr:2.625,quality:'sharp'});assert.deepEqual([native.width,native.height],[2363,1050]);
 const limited=matchResolution({width:900,height:400,dpr:3,quality:'sharp',maxSize:2048});assert.equal(limited.width,2048);assert(limited.height<2048);
});

test('Auto retains at least one render pixel per CSS pixel unless the GPU itself is smaller',()=>{
 for(const dpr of[1,1.5,2,3])for(const scale of[.01,.55,.75,1]){const p=matchResolution({width:900,height:400,dpr,scale});assert(p.width>=900&&p.height>=400);}
 for(const scale of[NaN,Infinity,0]){const p=matchResolution({width:900,height:400,scale});assert(Number.isFinite(p.width)&&Number.isFinite(p.height));}
});

test('Auto lowers sustained overload, ignores brief stutters and recovers after sustained spare time',()=>{
 const auto=createAutoResolutionController();let t=5000;for(let i=0;i<8;i++){auto.sample(1/15,t);t+=1000/15;}assert.equal(auto.scale,1,'a brief shader/upload stutter must not resize the framebuffer');
 for(let i=0;i<30;i++){auto.sample(1/15,t);t+=1000/15;}assert(auto.scale<.75&&auto.scale>=.5,'sustained load is reduced within the first few seconds');
 for(let i=0;i<120;i++){auto.sample(1/15,t);t+=1000/15;}assert.equal(auto.scale,.5);
 const reduced=auto.scale;for(let i=0;i<120;i++){auto.sample(1/30,t);t+=1000/30;}assert.equal(auto.scale,reduced,'do not pump resolution every few frames');
 for(let i=0;i<1000;i++){auto.sample(i%50===0?.05:1/30,t);t+=1000/30;}assert.equal(auto.scale,1,'recover clarity after the load ends');assert(!auto.sample(NaN,t));
 const sharp=matchResolution({width:900,height:400,dpr:2.625,quality:'sharp',scale:.75}),unchanged=matchResolution({width:900,height:400,dpr:2.625,quality:'sharp',scale:1});assert.deepEqual(sharp,unchanged);
});

test('Auto observes render work behind paced draws and respects the actual requested cadence',()=>{
 const slowWork=createAutoResolutionController({targetFps:30}),paced=createAutoResolutionController({targetFps:30}),highRefresh=createAutoResolutionController({targetFps:60});
 for(let i=0;i<50;i++){
  const now=i*1000/30;slowWork.sample(1/30,now,{renderMs:31});paced.sample(1/30,now,{renderMs:2});highRefresh.sample(1/30,now,{renderMs:2});
 }
 assert(slowWork.scale<1,'a nearly full render budget must adapt even if the draw loop is capped');
 assert.equal(paced.scale,1,'intentional healthy 30Hz pacing must not be treated as a slow 60Hz frame');
 assert(highRefresh.scale<1,'a 60Hz target should notice that only 30 frames are arriving');
 const before=slowWork.scale;assert.equal(slowWork.sample(12,12000,{renderMs:1}),false);assert.equal(slowWork.scale,before,'a background gap must not force another reduction');
});

test('motor11 starts Auto once, retains explicit ultra/fallback and respects every subsequent choice',()=>{
 let value;const storage={getItem:()=>value,setItem:(_,v)=>value=v};
 assert.deepEqual(readMatchPreferences(storage,11),{quality:'auto',view:'pro'});
 value=JSON.stringify({quality:'sharp',claritySchema:1,performanceSchema:1,cameraSchema:4,view:'broadcast'});
 assert.deepEqual(readMatchPreferences(storage,11),{quality:'auto',view:'broadcast'});
 for(const quality of['4k','simple']){value=JSON.stringify({quality});assert.equal(readMatchPreferences(storage,11).quality,quality);}
 for(const quality of['sharp','auto','4k','simple']){saveMatchPreferences({quality,view:'follow'},storage,11);assert.deepEqual(readMatchPreferences(storage,11),{quality,view:'follow'});}
 assert.equal(readMatchPreferences(undefined,10).quality,'sharp','legacy preference policy is preserved');
});

test('Nord-class high-DPR views reduce pixel work in Auto while keeping a CSS pixel floor and explicit sharp output',()=>{
 const phone={width:1008,height:450,dpr:2.75};
 const sharp=matchResolution({...phone,quality:'sharp'}),automatic=matchResolution(phone),pressured=matchResolution({...phone,scale:.5});
 assert(automatic.width*automatic.height<sharp.width*sharp.height*.35);
 assert(pressured.width*pressured.height<automatic.width*automatic.height*.5);
 assert.equal(pressured.width,phone.width);assert.equal(pressured.height,phone.height);
 assert.deepEqual(matchResolution({...phone,quality:'sharp',scale:.5}),sharp);
 assert.equal(Math.max(...Object.values(matchResolution({...phone,quality:'4k',scale:.5})).filter(v=>typeof v==='number')),3840);
});

test('new and upgraded v6 matches start Sharp once while 4K, fallback and later explicit Auto choices survive',()=>{
 let value;const storage={getItem:()=>value,setItem:(_,v)=>value=v};assert.equal(readMatchPreferences(storage,6).quality,'sharp');
 value=JSON.stringify({quality:'auto',view:'broadcast',performanceSchema:1,cameraSchema:4});assert.deepEqual(readMatchPreferences(storage,6),{quality:'sharp',view:'broadcast'});
 saveMatchPreferences({quality:'auto',view:'broadcast'},storage,6);assert.equal(readMatchPreferences(storage,6).quality,'auto');
 for(const quality of['4k','simple']){value=JSON.stringify({quality});assert.equal(readMatchPreferences(storage,6).quality,quality);}
 assert.equal(readMatchPreferences(undefined,5).quality,'auto','previous engines retain their preference migration');
});

test('oblique-surface filtering preserves colour spaces, UVs and shared texture identity and respects GPU limits',()=>{
 const scene=new THREE.Scene(),color=new THREE.Texture(),normal=new THREE.Texture(),roughness=new THREE.Texture();color.colorSpace=THREE.SRGBColorSpace;color.repeat.set(4,2);normal.colorSpace=THREE.NoColorSpace;
 const a=new THREE.MeshStandardMaterial({map:color,normalMap:normal,roughnessMap:roughness}),b=a.clone();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),a),new THREE.Mesh(new THREE.PlaneGeometry(),b));
 assert.equal(configureMatchTextures(scene,4),3);for(const texture of[color,normal,roughness]){assert.equal(texture.anisotropy,4);assert.equal(texture.magFilter,THREE.LinearFilter);assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);assert(texture.generateMipmaps);}
 assert.equal(color.colorSpace,THREE.SRGBColorSpace);assert.equal(normal.colorSpace,THREE.NoColorSpace);assert.deepEqual(color.repeat.toArray(),[4,2]);assert.equal(a.map,b.map);const version=color.version;configureMatchTextures(scene,4);assert.equal(color.version,version,'unchanged settings do not trigger another upload');
 configureMatchTextures(scene,64);assert.equal(color.anisotropy,16);configureMatchTextures(scene,0);assert.equal(color.anisotropy,1);
 scene.traverse(o=>o.geometry?.dispose());a.dispose();b.dispose();for(const t of[color,normal,roughness])t.dispose();
});
