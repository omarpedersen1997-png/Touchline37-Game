import{directionMask as modernDirection,SHOOT,PASS,SPRINT,SHOOT_HELD,PASS_HELD}from'../shared/football-modern.js';
import{SKILL}from'../shared/football-spaced.js';
import{screenToPitch}from'./match-camera.js';
const key='touchline:match-display:v1';
export function localMatchStorage(){try{return globalThis.localStorage;}catch{return undefined;}}
export function readMatchPreferences(storage=localMatchStorage(),version=1){
 let value;try{value=JSON.parse(storage?.getItem(key)||'null');}catch{}
 const known=['auto','sharp','4k','simple'].includes(value?.quality);
 if(version>=11)return{quality:value?.mobilePerformanceSchema===1&&known?value.quality:['4k','simple'].includes(value?.quality)?value.quality:'auto',view:['pro','broadcast','stadium','follow'].includes(value?.view)&&value?.cameraSchema===4?value.view:'pro'};
 if(version>=6)return{quality:value?.claritySchema===1&&known?value.quality:['4k','simple'].includes(value?.quality)?value.quality:'sharp',view:['pro','broadcast','stadium','follow'].includes(value?.view)&&value?.cameraSchema===4?value.view:'pro'};
 if(version>=3)return{quality:version>=5&&['4k','sharp'].includes(value?.quality)&&value?.performanceSchema!==1?'auto':['auto','sharp','4k','simple'].includes(value?.quality)?value.quality:'auto',view:['pro','broadcast','stadium','follow'].includes(value?.view)&&value?.cameraSchema===(version>=5?4:3)?value.view:'pro'};
 return{quality:['auto','sharp','4k','simple'].includes(value?.quality)?value.quality:'auto',view:['broadcast','stadium','follow'].includes(value?.view)&&value?.cameraSchema===2?value.view:'follow'};
}
export function saveMatchPreferences(value,storage=localMatchStorage(),version=1){
 const preferences={quality:['auto','sharp','4k','simple'].includes(value.quality)?value.quality:'auto',view:(version>=3?['pro','broadcast','stadium','follow']:['broadcast','stadium','follow']).includes(value.view)?value.view:version>=3?'pro':'follow'};
 try{storage?.setItem(key,JSON.stringify({...preferences,mobilePerformanceSchema:version>=11?1:undefined,claritySchema:version>=6?1:undefined,performanceSchema:1,cameraSchema:version>=5?4:version>=3?3:2}));}catch{}
}
export function matchControlMask(keys,controls,view='stadium',version=1){
 const held=(...names)=>names.some(name=>keys.has(name));
 const hasMovement=held('w','a','s','d','arrowup','arrowdown','arrowleft','arrowright');
 const x=hasMovement?Number(held('d','arrowright'))-Number(held('a','arrowleft')):controls.x;
 const y=hasMovement?Number(held('s','arrowdown'))-Number(held('w','arrowup')):controls.y;
 const pitch=screenToPitch(x,y,view);
 if(version>=3)return modernDirection(pitch.x,pitch.y)|(controls.shoot?SHOOT:0)|(controls.pass?PASS:0)|(controls.sprint||held('shift')?SPRINT:0)|(controls.shootHeld?SHOOT_HELD:0)|(controls.passHeld?PASS_HELD:0)|(version>=4&&controls.skill?SKILL:0)|(version>=5&&controls.through?16384:0);
 let direction=0;if(Math.hypot(x,y)>=.2)direction=((Math.round(Math.atan2(pitch.x,-pitch.y)/(Math.PI/4))+8)%8)+1;
 return direction|(controls.shoot?16:0)|(controls.pass?32:0)|(controls.sprint||held('shift')?64:0);
}
export function isMatchShortcut(event){
 return !event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target?.isContentEditable&&!event.target?.closest?.('button,input,select,textarea,a');
}
