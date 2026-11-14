import{test}from'node:test';import assert from'node:assert/strict';
import{createMatchScene}from'../src/manual-scene.js';import{createArcade}from'../shared/arcade.js';
test('finished simple pitch redraws after resize without an animation loop and releases its observer on exit',()=>{
 const originalDocument=globalThis.document,originalObserver=globalThis.ResizeObserver;
 let callback,observing=false,draws=0,removed=false;
 const ctx=new Proxy({},{get:(_,key)=>key==='fillRect'?()=>draws++:()=>{},set:()=>true});
 const canvas={getContext:()=>ctx,remove(){removed=true},set width(v){this.w=v;draws=0;},get width(){return this.w},height:0};
 try{
  globalThis.document={createElement:()=>canvas};globalThis.ResizeObserver=class{constructor(fn){callback=fn}observe(){observing=true}disconnect(){observing=false}};
  const host={clientWidth:360,clientHeight:400,appendChild:()=>{}};
  const scene=createMatchScene(host,{quality:'simple'}),s=createArcade('static-final');s.tick=1200;scene.render(s);assert(draws>0);
  host.clientWidth=640;host.clientHeight=280;callback();assert.equal(canvas.width,832);assert(draws>0,'resizing must immediately redraw the completed field');
  scene.dispose();assert(removed);assert(!observing);const prior=draws;callback();assert.equal(draws,prior);
 }finally{globalThis.document=originalDocument;globalThis.ResizeObserver=originalObserver;}
});
