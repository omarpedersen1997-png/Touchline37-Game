import {test} from 'node:test';import assert from 'node:assert/strict';
import {enterMatchDisplay,exitMatchDisplay,toggleMatchExpansion} from '../src/match-display.js';
test('expanded match view is explicitly requested and its owned fullscreen is released on exit',async()=>{
 const prior=globalThis.document;let entries=0,exits=0;
 const element={async requestFullscreen(){entries++;globalThis.document.fullscreenElement=element;}};
 try{globalThis.document={fullscreenElement:null,async exitFullscreen(){exits++;this.fullscreenElement=null;}};
  await enterMatchDisplay();assert.equal(entries,0);assert.equal(await toggleMatchExpansion(element),true);assert.equal(entries,1);
  await exitMatchDisplay();assert.equal(exits,1);await exitMatchDisplay();assert.equal(exits,1);
 }finally{globalThis.document=prior;await exitMatchDisplay();}
});
test('unavailable fullscreen remains a harmless optional enhancement',async()=>{assert.equal(await toggleMatchExpansion({}),false);await exitMatchDisplay();});
