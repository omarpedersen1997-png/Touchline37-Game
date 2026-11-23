import{test}from'node:test';import assert from'node:assert/strict';
import{createMatchScene}from'../src/manual-scene.js';import{createArcade}from'../shared/arcade.js';
test('finished simple pitch redraws after resize without an animation loop and releases its observer on exit',()=>{
 const originalDocument=globalThis.document,originalObserver=globalThis.ResizeObserver;
 let callback,observing=false,draws=0,removed=false;
 const ctx=new Proxy({},{get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):key==='fillRect'?()=>draws++:()=>{},set:()=>true});
 const canvas={getContext:()=>ctx,remove(){removed=true},set width(v){this.w=v;draws=0;},get width(){return this.w},height:0};
 try{
  globalThis.document={createElement:()=>canvas};globalThis.ResizeObserver=class{constructor(fn){callback=fn}observe(){observing=true}disconnect(){observing=false}};
  const host={clientWidth:360,clientHeight:400,appendChild:()=>{}};
  const scene=createMatchScene(host,{quality:'simple'}),s=createArcade('static-final');s.tick=1200;scene.render(s);assert(draws>0);
  host.clientWidth=640;host.clientHeight=280;callback();assert.equal(canvas.width,832);assert(draws>0,'resizing must immediately redraw the completed field');
  scene.dispose();assert(removed);assert(!observing);const prior=draws;callback();assert.equal(draws,prior);
 }finally{globalThis.document=originalDocument;globalThis.ResizeObserver=originalObserver;}
});

test('simple rendering caches its pitch and interpolates players between engine ticks without mutating physics',()=>{
 const originalDocument=globalThis.document,originalObserver=globalThis.ResizeObserver;
 let create=0,backgroundFills=0,drawImages=0,gradients=0,time=500;const arcs=[];
 try{
  globalThis.document={createElement:()=>{const index=create++,ctx=new Proxy({},{get:(_,key)=>key==='createLinearGradient'?()=>{gradients++;return {addColorStop(){}};}:key==='fillRect'?()=>{if(index===1)backgroundFills++;}:key==='drawImage'?()=>drawImages++:key==='arc'?x=>{if(index===0)arcs.push(x);}:()=>{},set:()=>true});return{width:0,height:0,getContext:()=>ctx,remove(){}};}};
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  const scene=createMatchScene({clientWidth:853,clientHeight:384,appendChild(){}},{quality:'simple',getMatchTime:()=>time});
  const s=createArcade('interpolated-canvas',{matchVersion:11});s.tick=10;s.freeze=0;Object.assign(s.home[0],{x:0,y:0,vx:5,vy:0});const before=structuredClone(s);
  scene.render(s);const first=arcs[0],initialFills=backgroundFills;arcs.length=0;time=525;scene.render(s);assert(arcs[0]>first);
  for(let frame=0;frame<120;frame++)scene.render(s);assert.equal(backgroundFills,initialFills);assert.equal(gradients,1);assert.equal(drawImages,122);assert.deepEqual(s,before);scene.dispose();
 }finally{globalThis.document=originalDocument;globalThis.ResizeObserver=originalObserver;}
});

test('wide diagram control mapping matches the rotated pitch, while the legacy stadium axes are unchanged',async()=>{
 const {screenToPitch}=await import('../src/match-camera.js');
 assert.deepEqual(screenToPitch(1,0,'diagram'),{x:0,y:-1});
 assert.deepEqual(screenToPitch(0,1,'diagram'),{x:1,y:-0});
 assert.deepEqual(screenToPitch(1,0,'stadium'),{x:1,y:0});
});
