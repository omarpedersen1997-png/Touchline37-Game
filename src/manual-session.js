import {createArcade,stepArcade,getArcadeRules} from '../shared/arcade.js';
const prefix='touchline:manual:v1:';
export function createManualSession(match,{storage,now=Date.now()}={}){
 const version=match.manual.version||match.manual.config?.matchVersion||1,{INPUT_MS,INPUT_COUNT,STEP_MS,validateMask,encodeInputs}=getArcadeRules(version),steps=INPUT_MS/STEP_MS;
 const key=prefix+match.id,inputs=[];let cleared=false;
 try{const owned=[];for(let i=0;i<(storage?.length||0);i++){const k=storage.key(i);if(k?.startsWith(prefix))owned.push(k);}for(const k of owned){let data;try{data=JSON.parse(storage.getItem(k));}catch{}if(data&&[6,7].includes(data.version)&&!data.retentionVersion&&Array.isArray(data.inputs)&&data.inputs.length===5000&&data.inputs.every(getArcadeRules(data.version).validateMask)){data.expiresAt=Math.max(data.expiresAt,data.expiresAt-180000+86400000);data.retentionVersion=2;storage.setItem(k,JSON.stringify(data));}if(!data||(k!==key&&data.expiresAt<now))storage.removeItem(k);}for(const k of owned.filter(k=>k!==key).slice(0,-7))storage.removeItem(k);}catch{}let state=createArcade(match.manual.seed,match.manual.config);
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved?.seed===match.manual.seed&&(version<3||saved.version===version)&&Array.isArray(saved.inputs)&&saved.inputs.length<=INPUT_COUNT&&saved.inputs.every(validateMask))inputs.push(...saved.inputs);}catch{}
 for(const mask of inputs){for(let i=0;i<steps;i++)stepArcade(state,mask);}
 const add=mask=>{inputs.push(mask);for(let i=0;i<steps;i++)stepArcade(state,mask);};
 const save=()=>{if(cleared)return;try{storage?.setItem(key,JSON.stringify({version,retentionVersion:2,seed:match.manual.seed,inputs,expiresAt:Math.max(match.manual.expiresAt||0,(Number.isFinite(match.ends)?match.ends:match.started+INPUT_COUNT*INPUT_MS)+86400000)}));}catch{}};
 // Time spent away cannot be replayed with newly chosen controls.
 const advance=(time,mask=0)=>{const count=Math.min(INPUT_COUNT,Math.max(0,Math.floor((time-match.started)/INPUT_MS)));while(inputs.length<count)add(inputs.length===count-1?mask:0);return state;};
 advance(now);save();
 return{inputMs:INPUT_MS,duration:INPUT_COUNT*INPUT_MS,get state(){return state;},get count(){return inputs.length;},get complete(){return inputs.length===INPUT_COUNT;},advance,save,packet:()=>inputs.length===INPUT_COUNT?encodeInputs(inputs):null,clear(){cleared=true;try{storage?.removeItem(key);}catch{}}};
}
export function directionMask(x,y){if(Math.hypot(x,y)<.2)return 0;return ((Math.round(Math.atan2(x,-y)/(Math.PI/4))+8)%8)+1;}
