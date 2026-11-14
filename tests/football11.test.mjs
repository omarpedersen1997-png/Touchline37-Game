import{test}from'node:test';import assert from'node:assert/strict';
import{createArcade,stepArcade,replayArcade,INPUT_COUNT,encodeInputs,DURATION_MS}from'../shared/arcade.js';
import * as legacy from'../shared/arcade-v1.js';
import{createGame,apply}from'../worker/game.js';
import{playerCareerAction}from'../worker/player-career.js';
import{createManualSession}from'../src/manual-session.js';
import{stadiumLayout,stadiumProjection,boxCorners}from'../src/stadium-layout.js';
import{screenToPitch,matchCamera}from'../src/match-camera.js';
import{buildMatchStadium,buildMatchPlayer}from'../src/manual-scene.js';import * as THREE from'three';
const inputs=Uint8Array.from({length:INPUT_COUNT},(_,i)=>i%41===0?16:i%39===0?32:65);
test('eleven-a-side replays are deterministic, bounded and include the real saved formation',()=>{
 for(const formation of['4-3-3','4-4-2','3-5-2','4-5-1']){
  const config={matchVersion:2,formation,homeRating:65,awayRating:58};
  const a=replayArcade('eleven',config,inputs),b=replayArcade('eleven',config,inputs);assert.deepEqual(a,b);assert.equal(a.home.length,11);assert.equal(a.away.length,11);assert.equal(a.tick,1200);assert.equal(a.version,2);assert.equal(a.events.length,a.homeScore+a.awayScore);assert.equal(a.positions.length,11);assert(!/NaN|Infinity/.test(JSON.stringify(a)));
  for(const p of[...a.home,...a.away]){assert(Math.abs(p.x)<=29);assert(Math.abs(p.y)<=46);assert(p.energy>=0&&p.energy<=100);}
 }
 assert.notDeepEqual(createArcade('shape',{matchVersion:2,formation:'4-3-3'}).home,createArcade('shape',{matchVersion:2,formation:'4-4-2'}).home);
});
test('legacy replay remains byte-for-byte identical so an already installed APK can finish its game',()=>{assert.deepEqual(replayArcade('existing',{tactic:'attacking'},inputs),legacy.replayArcade('existing',{tactic:'attacking'},inputs));assert.equal(createArcade('old').home.length,5);});
test('new club mode opts into 11 players and the server validates the replay and pays only once',()=>{
 const s=createGame(0);apply(s,{id:'tactic',type:'formation',key:'4-4-2'},0);apply(s,{id:'full',type:'match',control:'manual',manualVersion:2},0);const m=structuredClone(s.active);assert.equal(m.manual.version,2);assert.equal(m.manual.config.formation,'4-4-2');
 const session=createManualSession(m,{now:0});session.advance(DURATION_MS,65);const expected=replayArcade(m.manual.seed,m.manual.config,Uint8Array.from(atob(session.packet()),c=>c.charCodeAt(0)));
 apply(s,{id:'done',type:'manual-match-finish',matchId:m.id,inputs:session.packet(),home:999},DURATION_MS);assert.equal(s.history[0].home,expected.homeScore);assert.equal(s.history[0].away,expected.awayScore);assert.equal(s.played,1);const bank=s.money;apply(s,{id:'retry',type:'manual-match-finish',matchId:m.id,inputs:session.packet()},DURATION_MS+1);assert.equal(s.money,bank);
});
test('eleven-a-side personal careers retain their own position including keeper and finish server-side',()=>{
 for(const[position,index]of[['ANG',10],['MID',6],['FOR',2],['MÅL',0]]){const s=createGame(0);playerCareerAction(s,{id:'p',type:'player-career-create',position,name:'Test',journeyVersion:1},0);playerCareerAction(s,{id:'pm',type:'player-career-match',control:'manual',manualVersion:2},0);const m=structuredClone(s.playerCareer.active),played=replayArcade(m.manual.seed,m.manual.config,inputs);assert.equal(played.controlled,index);assert.equal(played.home.length,11);playerCareerAction(s,{id:'finish',type:'player-career-manual-finish',matchId:m.id,inputs:encodeInputs(inputs)},DURATION_MS);assert.equal(s.playerCareer.stats.matches,1);assert.equal(s.played,0);}
});
test('stadium tiers stay outside the field and all structures fit the base at every stage',()=>{
 let previous=0;for(let stage=0;stage<4;stage++){const s=stadiumLayout(stage,{width:60,length:96});assert(s.rows>previous);previous=s.rows;for(const b of s.boxes){assert(Math.abs(b.x)+b.w/2<=s.base.width/2);assert(Math.abs(b.z)+b.d/2<=s.base.length/2);if(b.kind==='walkway')assert(b.y+b.h/2<s.pitchY,'grass must be above the stadium walkway to avoid depth occlusion');if(b.kind==='seating')assert(Math.abs(b.x)-b.w/2>=s.field.width/2+4.9||Math.abs(b.z)-b.d/2>=s.field.length/2+5.9);}
 const points=s.boxes.flatMap(boxCorners);s.poles.forEach(p=>points.push([p.x,p.height,p.z]));for(const view of['overview','tribune'])for(const angle of[-1.5,-.9,0,.5]){const{project}=stadiumProjection(points,angle,view);for(const p of points){const[x,y]=project(p);assert(x>=35&&x<=765);assert(y>=37&&y<=367);}}
 }
});
test('WebGL stadium uses tiered seating, one instanced crowd, complete goal nets and finite geometry',()=>{
 const scene=new THREE.Scene(),{layout,nets,crowd}=buildMatchStadium(scene,{width:60,length:96,goalWidth:8,goalHeight:2.4},2);assert.equal(nets.length,2);assert(crowd.isInstancedMesh);assert(crowd.count>100);assert.equal(layout.rows,7);for(const net of nets){const p=net.geometry.attributes.position;assert(p.count>0);const segments=Array.from({length:p.count/2},(_,i)=>[new THREE.Vector3().fromBufferAttribute(p,i*2),new THREE.Vector3().fromBufferAttribute(p,i*2+1)]);assert(segments.some(([a,b])=>Math.abs(a.z+net.position.z)===50&&Math.abs(b.z+net.position.z)===50&&a.y!==b.y));assert(segments.some(([a,b])=>Math.abs(a.x)===4&&Math.abs(b.x)===4&&a.z!==b.z));assert(segments.some(([a,b])=>Math.abs(a.y-2.4)<.001&&Math.abs(b.y-2.4)<.001&&a.z!==b.z));for(const v of p.array)assert(Number.isFinite(v));}scene.traverse(o=>{o.geometry?.dispose();if(o.isInstancedMesh)o.dispose();});
});
test('broadcast controls follow screen axes and camera plans stay finite at every field edge',()=>{
 const up=screenToPitch(0,-1,'broadcast'),right=screenToPitch(1,0,'broadcast');assert(Math.abs(up.x*right.x+up.y*right.y)<1e-10);assert.equal(Math.hypot(up.x,up.y),1);assert(right.y<0,'home attacks right on the broadcast view');assert.deepEqual(screenToPitch(.5,-1,'stadium'),{x:.5,y:-1});
 const s=createArcade('camera',{matchVersion:2});for(const x of[-30,30])for(const y of[-48,48]){s.ball={x,y};for(const view of['broadcast','follow','stadium'])for(const aspect of[.5,1,2.2]){const p=matchCamera(s,view,aspect);assert(p.eye[1]>0);assert([...p.eye,...p.target].every(Number.isFinite));}}
});

test('close camera keeps the controlled player visible on portrait and landscape screens without reversing input',()=>{const s=createArcade('close-camera',{matchVersion:2});for(const aspect of[.48,.75,1.5,2.4])for(const x of[-29,0,29])for(const z of[-46,0,46]){s.home[s.controlled].x=x;s.home[s.controlled].y=z;const plan=matchCamera(s,'follow',aspect),camera=new THREE.PerspectiveCamera(48,aspect,.1,320);camera.position.set(...plan.eye);camera.lookAt(new THREE.Vector3(...plan.target));camera.updateMatrixWorld();const point=new THREE.Vector3(x,1.4,z).project(camera);assert(Math.abs(point.x)<.8);assert(point.y>-.88&&point.y<.5);assert(plan.eye[1]<20);assert.equal(plan.eye[0],plan.target[0]);assert(plan.eye[2]>plan.target[2]);}assert.deepEqual(screenToPitch(1,-1,'follow'),{x:1,y:-1});});

test('articulated player geometry is finite, has usable textured numbers and releases its generated maps',()=>{const prior=globalThis.document;let drawn=[];try{const ctx=new Proxy({},{get:(_,key)=>key==='fillText'||key==='strokeText'?text=>drawn.push(text):()=>{},set:()=>true});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};const player=buildMatchPlayer('#c1f66b',11,false);assert.equal(player.userData.knees.length,2);assert.equal(player.userData.elbows.length,2);assert(drawn.includes('11'));const geometry=new Set(),materials=new Set(),maps=new Set();player.traverse(o=>{if(o.geometry){geometry.add(o.geometry);for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));}if(o.material){materials.add(o.material);if(o.material.map)maps.add(o.material.map);}});assert.equal(maps.size,2);player.updateMatrixWorld();const bounds=new THREE.Box3().setFromObject(player);assert(bounds.max.y>2&&bounds.max.y<5);for(const g of geometry)g.dispose();for(const m of materials)m.dispose();for(const map of maps)map.dispose();}finally{globalThis.document=prior;}});
