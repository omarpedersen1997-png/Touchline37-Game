import {createMatchScene,prepareMatchSceneAssets} from '../../src/manual-scene.js';
import {createArcade,getArcadeRules} from '../../shared/arcade.js';
import {matchCamera} from '../../src/match-camera.js';
let s=createArcade('touchline-visual58',{matchVersion:11,engineRevision:3,homeRating:65,awayRating:62,formation:'4-3-3',tactic:'balanced'}),rules=getArcadeRules(11,3);
s.autopilot=true;while(s.tick<550||s.freeze||s.goalSequence)rules.stepArcade(s,0);
const container=document.getElementById('field');let scene;
await prepareMatchSceneAssets({version:11,engineRevision:3,quality:'auto'});
window.drawVisual=async()=>{
 scene?.dispose();scene=createMatchScene(container,{version:11,initialState:s,players:11,field:s.field,quality:'auto',color:'#c1f66b',pattern:'stripe',getMatchTime:()=>s.tick*50,onResolution:r=>window.renderResolution=r});
 await scene.prepare();scene.render(s,'broadcast',true);
 const plan=matchCamera(s,'broadcast',container.clientWidth/container.clientHeight);return{tick:s.tick,ball:{x:s.ball.x,y:s.ball.y,z:s.ball.z},camera:plan,mode:scene.mode,resolution:window.renderResolution};
};
window.drawGoalVisual=async()=>{
 const search=structuredClone(s);let best=structuredClone(s);
 while(search.tick<2200){rules.stepArcade(search,0);if(!search.freeze&&!search.goalSequence&&Math.abs(search.ball.y)>Math.abs(best.ball.y))best=structuredClone(search);if(Math.abs(best.ball.y)>40)break;}
 s=best;return window.drawVisual();
};
window.visualResult=await window.drawVisual();window.visualReady=true;
window.drawFigures=async(kind='pass')=>{
 scene?.dispose();container.replaceChildren();
 const THREE=await import('three'),{createFootballPlayer,animateFootballPlayer,footballPlayerTemplate}=await import('../../src/pro-player.js');
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;container.appendChild(renderer.domElement);
 const world=new THREE.Scene();world.background=new THREE.Color('#112733');world.add(new THREE.HemisphereLight('#eef4ff','#324b28',1.1));const key=new THREE.DirectionalLight('#fff0d4',3.1);key.position.set(-4,7,5);world.add(key);const rim=new THREE.DirectionalLight('#91b9eb',.6);rim.position.set(3,4,-3);world.add(rim);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#255035',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;world.add(ground);
 const camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.1,100);camera.position.set(3.5,2.7,7.4);camera.lookAt(0,1,0);
 const models=[];for(let i=0;i<3;i++){
  const keeper=i===2,model=createFootballPlayer({source:footballPlayerTemplate('auto',keeper,true),number:i+7,keeper,color:i===1?'#3779c2':'#c1f66b',optimize:false});world.add(model);const p={...s.home[i],x:(i-1)*2.2,y:0,vx:0,vy:5,kick:0,dive:0,tackle:0,action:'run',facingX:0,facingY:1};
  for(let f=0;f<28;f++){
   if(f>12&&i===1){p.action='kick';p.actionDuration=7;p.kick=p.actionTicks=Math.max(1,7-(f-13)/3);}
   if(f>12&&keeper&&kind==='dive'){p.action='dive';p.actionDuration=10;p.dive=p.actionTicks=Math.max(1,10-(f-13)/3);p.diveX=-1;p.diveY=0;}
   model.position.set(p.x,0,p.y+f*.035);model.rotation.y=Math.PI;animateFootballPlayer(model,p,s,'home',i,1/60,true,f===0);
  }models.push(model);
 }
 renderer.render(world,camera);window.figureStats={kind,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,models:3};return window.figureStats;
};
