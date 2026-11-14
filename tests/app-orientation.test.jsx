import React from'react';
import{test}from'node:test';
import assert from'node:assert/strict';
import{renderToStaticMarkup}from'react-dom/server';
import AppOrientationGate,{appIsPortrait,guardPortraitApp}from'../src/AppOrientationGate.jsx';

const viewport=({width,height,coarse=false,type,touchPoints=0})=>({innerWidth:width,innerHeight:height,navigator:{maxTouchPoints:touchPoints},screen:{orientation:{type}},matchMedia:query=>({matches:query==='(pointer: coarse)'?coarse:height>width})});
test('portrait handsets remain blocked when their keyboard shrinks the viewport into a wide rectangle',()=>{
 for(const coarse of[true,false])assert(appIsPortrait(viewport({width:412,height:240,coarse,type:'portrait-primary',touchPoints:1})));
 assert(appIsPortrait(viewport({width:412,height:915,coarse:true,type:'portrait-secondary'})));
});
test('landscape phones and tablets can use the app while tall desktop windows still show the rotation cover',()=>{
 for(const[width,height]of[[915,412],[800,360],[568,320],[1280,800]])assert(!appIsPortrait(viewport({width,height,coarse:true,type:'landscape-primary'})));
 assert(appIsPortrait(viewport({width:700,height:950,coarse:false,type:'landscape-primary'})));
 assert(appIsPortrait(viewport({width:412,height:915,coarse:true,type:'landscape-primary'})));
 assert.equal(appIsPortrait(null),false);
});
test('portrait markup hides and makes the mounted app inert without discarding its child state',()=>{
 const prior=globalThis.window;
 try{
  globalThis.window=viewport({width:412,height:915,coarse:true,type:'portrait-primary'});
  const html=renderToStaticMarkup(<AppOrientationGate><button data-match-id="pending">Gem kampresultat</button></AppOrientationGate>);
  assert(html.includes('data-orientation="portrait"'));
  assert.match(html,/<div class="app-orientation-content"[^>]*hidden=""[^>]*inert=""[^>]*aria-hidden="true"/);
  assert(html.includes('data-match-id="pending"'));
  assert(html.includes('role="dialog" aria-modal="true"'));
  assert(html.includes('Hele Touchline spilles i bredformat'));
  globalThis.window=viewport({width:915,height:412,coarse:true,type:'landscape-primary'});
  const wide=renderToStaticMarkup(<AppOrientationGate><button>Fortsæt</button></AppOrientationGate>);
  assert(wide.includes('data-orientation="landscape"'));
  assert(!wide.includes('inert=""'));
  assert.match(wide,/<section class="app-orientation-screen" hidden=""/);
 }finally{globalThis.window=prior;}
});
test('portrait input guard releases held controls, blocks game shortcuts and restores focus and listeners on rotation',()=>{
 const listeners=new Map(),docListeners=new Map();let held=true,focused=0,blurred=0,restored=0;
 const previous={isConnected:true,blur:()=>blurred++,focus:()=>restored++},inside={closest:()=>null},support={closest:key=>key==='a'?{}:null};
 const view={dispatchEvent:event=>{if(event.type==='blur')held=false;},addEventListener:(name,fn,capture)=>{assert.equal(capture,true);listeners.set(name,fn);},removeEventListener:(name,fn,capture)=>{assert.equal(capture,true);assert.equal(listeners.get(name),fn);listeners.delete(name);}};
 const doc={activeElement:previous,body:{style:{overflow:'auto'}},addEventListener:(name,fn,capture)=>{assert.equal(capture,true);docListeners.set(name,fn);},removeEventListener:(name,fn,capture)=>{assert.equal(capture,true);assert.equal(docListeners.get(name),fn);docListeners.delete(name);}};
 const close=guardPortraitApp({view,doc,gate:{contains:target=>target===inside||target===support},heading:{focus:()=>focused++}});
 assert.equal(held,false);assert.equal(blurred,1);assert.equal(focused,1);assert.equal(doc.body.style.overflow,'hidden');
 const key=(name,target=inside)=>{const event={type:'keydown',key:name,target,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};listeners.get('keydown')(event);return event;};
 for(const name of['ArrowUp','e','Shift',' ','Escape']){const e=key(name);assert(e.prevented&&e.stopped);}
 assert.equal(key('Tab').prevented,false,'native focus navigation remains available');
 assert.equal(key('Enter',support).prevented,false,'support can still be activated with a keyboard');
 docListeners.get('focusin')({target:{}});assert.equal(focused,2);
 close();assert.equal(doc.body.style.overflow,'auto');assert.equal(restored,1);assert.equal(listeners.size,0);assert.equal(docListeners.size,0);
});

