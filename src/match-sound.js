import {matchAssetRoot} from './match-asset-config.js';
import {createMatchSampleBank} from './match-sample-bank.js';
import {isAppHidden} from './app-visibility.js';
const key='touchline:match-sound:v1';
export function createMatchSound({storage,Audio=globalThis.AudioContext||globalThis.webkitAudioContext,hidden=isAppHidden,assetRoot=matchAssetRoot,fetcher=globalThis.fetch}={}){
 let context=null,master=null,samples=null,disposed=false,enabled=false,epoch=0,unlocking=null,crowdBuffer=null,lastImpact=-Infinity,lastChance=-Infinity;
 const fallback=new Set(),stops=new Map();
 try{enabled=storage?.getItem(key)==='on';}catch{}
 const allowed=()=>!disposed&&enabled&&!hidden();
 const available=()=>fallback.size+(samples?.voices||0)<8;
 const sample=(name,options)=>allowed()&&available()&&samples?.play(name,options)||false;
 function voice(source,nodes){
  fallback.add(source);let ended=false;
  const clean=()=>{if(ended)return;ended=true;fallback.delete(source);stops.delete(source);try{source.disconnect();}catch{}for(const n of nodes)try{n.disconnect();}catch{}};
  source.onended=clean;stops.set(source,()=>{try{source.stop();}catch{}clean();});
 }
 function stopAll(){samples?.stopAll();for(const stop of [...stops.values()])stop();stops.clear();fallback.clear();}
 function unlock(){
  if(!allowed()||!Audio)return;
  if(unlocking)return unlocking;
  try{
   context||=new Audio();if(!master){master=context.createGain();master.connect(context.destination);}master.gain.value=1;
   if(assetRoot&&context.decodeAudioData)samples||=createMatchSampleBank(context,{base:assetRoot,output:master,allowed:()=>allowed()&&available(),fetcher});
   const current=context,generation=epoch,valid=()=>allowed()&&current===context&&generation===epoch;
   const job=Promise.resolve(current.resume()).then(async()=>{
    if(!valid()){if(!allowed())try{await current.suspend?.();}catch{}return;}
    await samples?.load();if(valid())samples?.ambient();
   }).catch(()=>{}).finally(()=>{if(unlocking===job)unlocking=null;});unlocking=job;return job;
  }catch{}
 }
 const ready=()=>allowed()&&context?.state==='running'&&available();
 function tone(frequency,at,duration,amplitude=.025,type='sine'){
  if(!ready())return null;
  const node=context.createOscillator(),gain=context.createGain();node.type=type;node.connect(gain);gain.connect(master);node.frequency.value=frequency;
  gain.gain.setValueAtTime(amplitude,at);gain.gain.exponentialRampToValueAtTime(.001,at+duration-.05);voice(node,[gain]);return{node,gain};
 }
 return{
  get enabled(){return enabled;},get voices(){return fallback.size+(samples?.voices||0);},unlock,
  toggle(){if(disposed)return false;enabled=!enabled;epoch++;unlocking=null;try{storage?.setItem(key,enabled?'on':'off');}catch{}if(enabled)unlock();else{if(master)master.gain.value=0;stopAll();}return enabled;},
  chance(){if(!ready()||context.currentTime-lastChance<4)return false;const played=sample('crowd-chance',{gain:.22});if(played)lastChance=context.currentTime;return played;},
  contact(kind='touch',power=.5){if(!ready())return false;return sample('kick-soft',{gain:kind==='save'?.22:.1+Math.max(0,Math.min(1,power))*.12});},
  goal(){
   if(!ready())return false;if(sample('net',{gain:.5}))return true;
   try{for(const [i,f] of [392,494,587].entries()){const at=context.currentTime+i*.09,v=tone(f,at,.4);if(v){v.node.start(at);v.node.stop(at+.4);}}return true;}catch{return false;}
  },
  impact(kind='kick',power=.5){
   if(!ready()||context.currentTime-lastImpact<.065)return false;
   if(sample(kind==='woodwork'?'woodwork':Number(power)>.65?'kick-hard':'kick-soft',{gain:kind==='woodwork'?.5:.65})){lastImpact=context.currentTime;return true;}
   try{const at=context.currentTime,metal=kind==='woodwork',duration=metal?.32:.1,v=tone(metal?680:110,at,duration,metal?.025:.018+Math.min(1,Math.max(0,Number(power)||.5))*.012,metal?'triangle':'sine');if(!v)return false;lastImpact=at;v.node.frequency.setValueAtTime(metal?680:110,at);v.node.frequency.exponentialRampToValueAtTime(metal?390:45,at+(metal?.24:.07));v.node.start(at);v.node.stop(at+duration);return true;}catch{return false;}
  },
  crowd(){
   if(!ready()||!context.createBufferSource)return false;if(sample('crowd-goal',{gain:.32}))return true;
   try{
    if(!crowdBuffer){crowdBuffer=context.createBuffer(1,22050,22050);const data=crowdBuffer.getChannelData(0);let seed=7183;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.35;}}
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),at=context.currentTime;source.buffer=crowdBuffer;filter.type='lowpass';filter.frequency.value=900;source.connect(filter);filter.connect(gain);gain.connect(master);gain.gain.setValueAtTime(.001,at);gain.gain.linearRampToValueAtTime(.025,at+.12);gain.gain.exponentialRampToValueAtTime(.001,at+.95);voice(source,[filter,gain]);source.start(at);source.stop(at+1);return true;
   }catch{return false;}
  },
  whistle(kind='kickoff'){
   if(!ready())return false;const count=kind==='finished'?3:kind==='halftime'?2:1;
   if(sample('whistle',{gain:.35})){for(let i=1;i<count;i++)sample('whistle',{gain:.35,at:context.currentTime+i*.38});return true;}
   try{for(let i=0;i<count;i++){const at=context.currentTime+i*.24,v=tone(2200,at,.2,.018);if(!v)continue;v.node.frequency.setValueAtTime(2200,at);v.node.frequency.linearRampToValueAtTime(2550,at+.06);v.node.frequency.linearRampToValueAtTime(2250,at+.16);v.gain.gain.setValueAtTime(.001,at);v.gain.gain.linearRampToValueAtTime(.018,at+.02);v.node.start(at);v.node.stop(at+.2);}return true;}catch{return false;}
  },
  suspend(){epoch++;unlocking=null;stopAll();if(master)master.gain.value=0;try{Promise.resolve(context?.suspend()).catch(()=>{});}catch{}},
  dispose(){if(disposed)return;disposed=true;epoch++;unlocking=null;stopAll();samples?.dispose();samples=null;try{Promise.resolve(context?.close()).catch(()=>{});}catch{}context=null;master=null;crowdBuffer=null;}
 };
}
