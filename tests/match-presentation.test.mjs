import{test}from'node:test';import assert from'node:assert/strict';
import{motionBlend,detailPlayer,ballSpinStep}from'../src/match-presentation.js';
test('motor 11 draws authoritative predicted motion without a second low-pass delay',()=>{
 const speed=7;let visual=0,previous=0;
 for(let i=1;i<=180;i++){const time=i/60,tick=Math.floor(time/.05),phase=time-tick*.05,target=tick*.05*speed+phase*speed;visual+=(target-visual)*motionBlend(11,.33);assert(Math.abs(visual-speed*time)<1e-9);assert(Math.abs((visual-previous)-speed/60)<1e-9);previous=visual;}
 for(let version=1;version<=10;version++)assert.equal(motionBlend(version,.33),.33);
});
test('automatic pressure actually drops an already-built high-detail player',()=>{
 const low={},high={},record={low,high,wanted:true};assert.equal(detailPlayer(record,true),high);record.wanted=false;assert.equal(detailPlayer(record,true),low);record.wanted=true;assert.equal(detailPlayer(record,false),low);record.high=null;assert.equal(detailPlayer(record,true),low);
});
test('ball spins at display cadence and preserves the same rotation over a full second',()=>{
 for(const hz of[30,60,120]){let sum=0;for(let i=0;i<hz;i++)sum+=ballSpinStep(11,{elapsed:1/hz,tickDelta:i%3===0?1:0});assert(Math.abs(sum-.24)<1e-9);}
 assert.equal(ballSpinStep(11,{elapsed:1/60,tickDelta:0,paused:true}),0);
 assert(ballSpinStep(11,{elapsed:1/60,tickDelta:0})>0);assert.equal(ballSpinStep(10,{elapsed:1/60,tickDelta:2}),.024);
});
