import {createArcade,stepArcade,getArcadeRules} from '../shared/arcade.js';
const prefix='touchline:manual:v1:';
function prepareManualSession(match,{storage,now=Date.now()}={}){
 const version=match.manual.version||match.manual.config?.matchVersion||1,{INPUT_MS,INPUT_COUNT,STEP_MS,validateMask,encodeInputs}=getArcadeRules(version),steps=INPUT_MS/STEP_MS;
 const key=prefix+match.id,inputs=[];let cleared=false,pendingInputs=0,inputApplied=false;
 try{const owned=[];for(let i=0;i<(storage?.length||0);i++){const k=storage.key(i);if(k?.startsWith(prefix))owned.push(k);}for(const k of owned){let data;try{data=JSON.parse(storage.getItem(k));}catch{}if(data&&[6,7].includes(data.version)&&!data.retentionVersion&&Array.isArray(data.inputs)&&data.inputs.length===5000&&data.inputs.every(getArcadeRules(data.version).validateMask)){data.expiresAt=Math.max(data.expiresAt,data.expiresAt-180000+86400000);data.retentionVersion=2;storage.setItem(k,JSON.stringify(data));}if(!data||(k!==key&&data.expiresAt<now))storage.removeItem(k);}}catch{}let state=createArcade(match.manual.seed,match.manual.config);
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved?.seed===match.manual.seed&&(version<3||saved.version===version)&&Array.isArray(saved.inputs)&&saved.inputs.length<=INPUT_COUNT&&saved.inputs.every(validateMask))inputs.push(...saved.inputs);}catch{}
 const restored=inputs.splice(0);
 const add=mask=>{inputs.push(mask);for(let i=0;i<steps;i++)stepArcade(state,mask);};
 const save=()=>{if(cleared)return;try{storage?.setItem(key,JSON.stringify({version,retentionVersion:2,seed:match.manual.seed,inputs,expiresAt:Math.max(match.manual.expiresAt||0,(Number.isFinite(match.ends)?match.ends:match.started+INPUT_COUNT*INPUT_MS)+86400000)}));}catch{}};
 // Time spent away cannot be replayed with newly chosen controls.
 const advance=(time,mask=0,{maxInputs=Infinity}={})=>{
  const count=Math.min(INPUT_COUNT,Math.max(0,Math.floor((time-match.started)/INPUT_MS))),before=inputs.length;
  const budget=maxInputs===Infinity?Infinity:Number.isInteger(maxInputs)&&maxInputs>0?Math.min(64,maxInputs):1;
  const stop=Math.min(count,inputs.length+budget);
  while(inputs.length<stop)add(inputs.length===count-1?mask:0);
  pendingInputs=Number.isFinite(count)?Math.max(0,count-inputs.length):0;
  inputApplied=inputs.length>before&&inputs.length===count;
  return state;
 };
 const target=Math.max(restored.length,Math.min(INPUT_COUNT,Math.max(0,Math.floor((now-match.started)/INPUT_MS))));
 const session={inputMs:INPUT_MS,duration:INPUT_COUNT*INPUT_MS,get state(){return state;},get count(){return inputs.length;},get complete(){return inputs.length===INPUT_COUNT;},get pendingInputs(){return pendingInputs;},get inputApplied(){return inputApplied;},advance,save,packet:()=>inputs.length===INPUT_COUNT?encodeInputs(inputs):null,clear(){cleared=true;try{storage?.removeItem(key);}catch{}}};
 return{session,target,initializeOne(){if(inputs.length>=target)return false;add(restored[inputs.length]??0);return true;},save};
}
export function createManualSession(match,options){
 const prepared=prepareManualSession(match,options);
 while(prepared.initializeOne()){}
 prepared.save();return prepared.session;
}
// Yield between bounded deterministic batches when restoring a long recording.
// No physics ticks are dropped, and cancellation never overwrites the recording.
export async function createManualSessionAsync(match,{signal,yieldWork=()=>new Promise(resolve=>setTimeout(resolve,0)),batchSize=32,onProgress,...options}={}){
 const check=()=>{if(signal?.aborted)throw signal.reason??new DOMException('Aborted','AbortError');};
 check();const prepared=prepareManualSession(match,options);
 const batch=Number.isInteger(batchSize)&&batchSize>0?Math.min(64,batchSize):32;
 let done=false,lastProgress=-1;
 const progress=()=>{
  const value=prepared.target?Math.min(100,Math.floor(prepared.session.count/prepared.target*10)*10):100;
  if(value!==lastProgress){lastProgress=value;if(typeof onProgress==='function')onProgress(value);}
 };
 progress();
 const clock=()=>globalThis.performance?.now?.()??Date.now();
 while(!done){
  check();const start=clock();
  for(let i=0;i<batch;i++){
   if(!prepared.initializeOne()){done=true;break;}
   if(clock()-start>=8)break;
  }
  progress();if(!done)await yieldWork();
 }
 check();prepared.save();return prepared.session;
}
export function directionMask(x,y){if(Math.hypot(x,y)<.2)return 0;return ((Math.round(Math.atan2(x,-y)/(Math.PI/4))+8)%8)+1;}
