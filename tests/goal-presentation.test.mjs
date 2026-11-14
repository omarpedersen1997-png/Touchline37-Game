import{test}from'node:test';
import assert from'node:assert/strict';
import * as THREE from'three';
import{isGoalCelebrant,goalCameraPlan,goalBallPosition,deformGoalNet}from'../src/goal-presentation.js';
import{buildMatchGoals}from'../src/manual-scene.js';
import{matchCamera}from'../src/match-camera.js';

const field={width:60,length:96,goalWidth:8,goalHeight:2.4};
const sequence={stage:'celebration',team:'home',scorer:10,celebrants:[10,8,9],startedTick:100,netSide:-1,point:{x:1,y:-48,z:.8}};
const state=()=>({version:10,tick:110,freeze:0,controlled:10,personalIndex:null,field,goalSequence:structuredClone(sequence),home:Array.from({length:11},()=>({x:0,y:0,vx:0,vy:0})),away:[],ball:{x:1,y:-49.5,z:.4,vx:0,vy:-14,vz:2}});

test('only stationary selected teammates celebrate, never dead-ball freezes or opponents',()=>{
 const s=state();assert(isGoalCelebrant(s,'home',10,s.home[10]));assert(isGoalCelebrant(s,'home',8,s.home[8]));
 assert(!isGoalCelebrant(s,'home',2,s.home[2]));assert(!isGoalCelebrant(s,'away',10,{vx:0,vy:0}));
 s.home[8].vx=2;assert(!isGoalCelebrant(s,'home',8,s.home[8]),'gathering players must walk rather than cheer while sliding');
 for(const stage of['net','kickoff']){s.goalSequence.stage=stage;assert(!isGoalCelebrant(s,'home',10,s.home[10]));}
 s.goalSequence=null;s.freeze=10;s.events=[{kind:'goal',side:'home'}];assert(!isGoalCelebrant(s,'home',10,s.home[10]));
});

test('historical goal snapshots allow their own cheer but never a later corner or halftime',()=>{
 const s=state();s.version=9;s.goalSequence=null;s.lastGoal={tick:100,side:'home'};s.freeze=12;assert(isGoalCelebrant(s,'home',1,s.home[1]));
 s.tick=250;s.restart={kind:'corner',tick:250};assert(!isGoalCelebrant(s,'home',1,s.home[1]));
 s.tick=2400;s.period='halftime';assert(!isGoalCelebrant(s,'home',1,s.home[1]));
});

test('goal camera remains over the goal and preserves the chosen lens when control switches',()=>{
 const s=state();
 for(const view of['broadcast','pro','follow']){
  let target;
  for(const controlled of[1,10,5]){
   s.controlled=controlled;s.home[controlled].x=controlled*2;s.home[controlled].y=controlled*3;
   const plan=matchCamera(s,view,1.9),goal=goalCameraPlan(plan,s);
   assert.equal(goal.fov,plan.fov);assert.deepEqual(goal.eye.map((v,i)=>Math.round((v-goal.target[i])*1e6)),plan.eye.map((v,i)=>Math.round((v-plan.target[i])*1e6)));
   assert.equal(goal.target[2],-45);if(target)assert.deepEqual(goal.target,target);target=goal.target;
  }
 }
 const base=matchCamera(s,'broadcast',1.9);s.goalSequence.stage='kickoff';assert.equal(goalCameraPlan(base,s),base,'kickoff uses normal center-circle framing');
});

test('ball subframes remain inside real net contact bounds without mutating physics',()=>{
 const s=state(),original=structuredClone(s.ball),point=goalBallPosition(s,.045);
 assert.equal(point.y,-49.78);assert(point.z>=.22&&point.z<=2.18);assert.deepEqual(s.ball,original);
 for(const sign of[-1,1]){s.goalSequence.netSide=sign;Object.assign(s.ball,{x:3.77,y:sign*49.7,z:2.1,vx:20,vy:sign*25,vz:12});const p=goalBallPosition(s,.045);assert.equal(p.x,3.78);assert.equal(p.y,sign*49.78);assert(Math.abs(p.z-2.18)<1e-12);}
 Object.assign(s.ball,{x:0,y:48.05,z:.22,vx:0,vy:-4,vz:0});s.goalSequence.netSide=1;assert(goalBallPosition(s,.045).y<48,'a net rebound can roll through the open mouth onto the pitch');
 s.goalSequence=null;assert.equal(goalBallPosition(s,.045).x,s.ball.x+s.ball.vx*.045,'ordinary play keeps its existing prediction');
});

test('actual goal grids ripple locally only at the struck net, with front anchors pinned',()=>{
 const scene=new THREE.Scene(),nets=buildMatchGoals(scene,field),s=state();s.goalSequence.impact={tick:108,x:1,y:-49.78,z:.8,strength:1,surface:'back'};
 let changed=0;
 for(const net of nets){
  const positions=net.geometry.attributes.position,rest=net.userData.restNet;
  const active=deformGoalNet(positions.array,rest,s,net.userData.netSign,field);
  assert.equal(active,net.userData.netSign===-1);
  for(let i=0;i<rest.length;i+=3){
   if(rest[i+2]===0)assert.deepEqual(Array.from(positions.array.slice(i,i+3)),Array.from(rest.slice(i,i+3)),'mouth posts and crossbar remain fixed');
   if(positions.array[i+2]!==rest[i+2])changed++;
  }
 }
 assert(changed>5,'the struck net deforms without moving the other goal');
 const front=nets[0],near=front.geometry.attributes.position.array.findIndex((_,i)=>i%3===2&&Math.abs(front.userData.restNet[i]-(-2))<.01);assert(near>=0);
 s.tick=200;assert.equal(deformGoalNet(front.geometry.attributes.position.array,front.userData.restNet,s,-1,field),false,'ripple expires so the renderer can restore its static geometry');
 const geometry=new Set(),material=new Set();scene.traverse(node=>{if(node.geometry)geometry.add(node.geometry);if(node.material)material.add(node.material);});geometry.forEach(g=>g.dispose());material.forEach(m=>m.dispose());
});

test('the whole-pitch camera retains its fixed overview during a goal',()=>{
 const state={goalSequence:{stage:'net',point:{x:1,y:-48}}},plan={eye:[0,103,62],target:[0,0,0],fov:48};
 assert.equal(goalCameraPlan(plan,state,'stadium'),plan);
});
