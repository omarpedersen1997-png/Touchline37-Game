import{test}from'node:test';import assert from'node:assert/strict';import{Quaternion,Vector3}from'three';
import{createFootballSwing}from'../src/football-swing.js';import{createMatchViewport}from'../src/match-viewport.js';
function reference(bones,base,rest){const axes={x:new Vector3(1,0,0),y:new Vector3(0,1,0),z:new Vector3(0,0,1)};return(name,x=0,y=0,z=0)=>{const bone=bones[name];if(!bone)return;const delta=new Quaternion();for(const[axis,value]of[['x',x],['y',y],['z',z]])if(value)delta.multiply(new Quaternion().setFromAxisAngle(axes[axis].clone().applyQuaternion(rest.get(name)?.clone().invert()||new Quaternion()),value));bone.quaternion.copy(base.get(name)).premultiply(delta);};}
test('cached football action rotations match the previous layer without changing the captured rest pose',()=>{
 const names=['RightUpLeg','RightLeg','Spine2','LeftArm','RightArm','Custom'],bones={},old={},base=new Map(),rest=new Map();
 for(let i=0;i<names.length;i++){const name=names[i];bones[name]={quaternion:new Quaternion()};old[name]={quaternion:new Quaternion()};base.set(name,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),i*.13));rest.set(name,new Quaternion().setFromAxisAngle(new Vector3(1,1,0).normalize(),i*.21));}
 const baseline=reference(old,base,rest),swing=createFootballSwing(bones,base,rest),before=[...rest.values()].map(q=>q.toArray());
 for(let frame=0;frame<1000;frame++)for(const name of names){const x=Math.sin(frame*.2),y=frame%2?0:Math.cos(frame*.13),z=frame%5?.4:0;baseline(name,x,y,z);swing(name,x,y,z);assert(bones[name].quaternion.angleTo(old[name].quaternion)<1e-7);}
 swing('missing',1,1,1);assert.deepEqual([...rest.values()].map(q=>q.toArray()),before);
 const other={RightLeg:{quaternion:new Quaternion()}},otherSwing=createFootballSwing(other,base,rest);const saved=bones.RightLeg.quaternion.clone();otherSwing('RightLeg',2,1,3);assert(bones.RightLeg.quaternion.equals(saved));
});
test('match draws reuse viewport size; only a resize reads layout and zero dimensions remain safe',()=>{
 let reads=0,width=1280,height=576;const viewport=createMatchViewport({get clientWidth(){reads++;return width;},get clientHeight(){reads++;return height;}});
 viewport.refresh();assert.equal(reads,2);
 for(let i=0;i<600;i++){assert.equal(viewport.width,1280);assert.equal(viewport.height,576);}assert.equal(reads,2);
 width=900;height=400;viewport.refresh();assert.equal(viewport.width,900);assert.equal(viewport.height,400);assert.equal(reads,4);
 width=0;height=0;viewport.refresh();assert.equal(viewport.width,1);assert.equal(viewport.height,1);
});

test('replays sample only submitted frames at 120Hz and always include the final real frame once',async()=>{
 const{createReplayPlayback}=await import('../src/replay-playback.js');
 for(const fps of[30,60]){const samples=[],play=createReplayPlayback({durationMs:1000},{targetFps:fps,sample:(_,time)=>{samples.push(time);return{time};}});let final;for(let i=0;i<=120;i++)final=play(i*1000/120);assert.equal(final.complete,true);assert.equal(final.state.time,1000);assert.equal(samples[0],0);assert.equal(samples.at(-1),1000);assert.equal(samples.length,fps+1);assert.deepEqual(play(1100),{state:null,complete:true});assert.equal(samples.length,fps+1);}
});
test('joystick projection retains direction/range and reads layout once per gesture, reset or changed element',async()=>{
 const{createJoystickProjector}=await import('../src/match-joystick.js');let reads=0;const rect={left:20,top:30,width:160,height:160},element={getBoundingClientRect:()=>{reads++;return rect;}},input=createJoystickProjector();input.begin(element);
 for(let i=0;i<120;i++){const x=Math.sin(i)*180+100,y=Math.cos(i)*180+110,dx=(x-100)/(160*.36),dy=(y-110)/(160*.36),len=Math.max(1,Math.hypot(dx,dy));const result=input.project(element,x,y);assert(Math.abs(result.x-dx/len)<1e-12);assert(Math.abs(result.y-dy/len)<1e-12);assert(Math.hypot(result.x,result.y)<=1.00000001);}assert.equal(reads,1);
 input.reset();rect.width=200;input.project(element,100,110);assert.equal(reads,2);const other={getBoundingClientRect:()=>{reads++;return{...rect,width:0};}};assert.deepEqual(input.project(other,100,110),{x:0,y:0});assert.equal(reads,3);
});
