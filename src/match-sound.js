const key='touchline:match-sound:v1';
export function createMatchSound({storage,Audio=globalThis.AudioContext||globalThis.webkitAudioContext,hidden=()=>globalThis.document?.hidden}={}) {
 let context=null,master=null,disposed=false,enabled=false,crowdBuffer=null,lastImpact=-Infinity;
 try{enabled=storage?.getItem(key)==='on';}catch{}
 const unlock=()=>{
  if(disposed||!enabled||hidden()||!Audio)return;
  try{context||=new Audio();if(!master){master=context.createGain();master.connect(context.destination);}master.gain.value=1;Promise.resolve(context.resume()).catch(()=>{});}catch{}
 };
 return {get enabled(){return enabled;},unlock,
  toggle(){enabled=!enabled;try{storage?.setItem(key,enabled?'on':'off');}catch{}if(enabled)unlock();else if(master)master.gain.value=0;return enabled;},
  goal(){
   if(disposed||!enabled||hidden()||!context||context.state!=='running')return false;
   try{for(const [i,frequency] of [392,494,587].entries()){const tone=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.09;tone.connect(gain);gain.connect(master);tone.frequency.value=frequency;gain.gain.setValueAtTime(.025,at);gain.gain.exponentialRampToValueAtTime(.001,at+.35);tone.start(at);tone.stop(at+.4);tone.onended=()=>{tone.disconnect();gain.disconnect();};}return true;}catch{return false;}
  },
  impact(kind='kick',power=.5){
   if(disposed||!enabled||hidden()||!context||context.state!=='running'||context.currentTime-lastImpact<.065)return false;
   try{lastImpact=context.currentTime;const tone=context.createOscillator(),gain=context.createGain(),at=context.currentTime,metal=kind==='woodwork';tone.type=metal?'triangle':'sine';tone.connect(gain);gain.connect(master);tone.frequency.setValueAtTime(metal?680:110,at);tone.frequency.exponentialRampToValueAtTime(metal?390:45,at+(metal?.24:.07));gain.gain.setValueAtTime(metal?.025:.018+Math.min(1,Math.max(0,Number(power)||.5))*.012,at);gain.gain.exponentialRampToValueAtTime(.001,at+(metal?.3:.09));tone.start(at);tone.stop(at+(metal?.32:.1));tone.onended=()=>{tone.disconnect();gain.disconnect();};return true;}catch{return false;}
  },
  crowd(){
   if(disposed||!enabled||hidden()||!context||context.state!=='running'||!context.createBufferSource)return false;
   try{if(!crowdBuffer){crowdBuffer=context.createBuffer(1,22050,22050);const data=crowdBuffer.getChannelData(0);let seed=7183;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.35;}}const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),at=context.currentTime;source.buffer=crowdBuffer;filter.type='lowpass';filter.frequency.value=900;source.connect(filter);filter.connect(gain);gain.connect(master);gain.gain.setValueAtTime(.001,at);gain.gain.linearRampToValueAtTime(.025,at+.12);gain.gain.exponentialRampToValueAtTime(.001,at+.95);source.start(at);source.stop(at+1);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};return true;}catch{return false;}
  },
  whistle(kind='kickoff'){
   if(disposed||!enabled||hidden()||!context||context.state!=='running')return false;
   try{const count=kind==='finished'?3:kind==='halftime'?2:1;for(let i=0;i<count;i++){const tone=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.24;tone.connect(gain);gain.connect(master);tone.frequency.setValueAtTime(2200,at);tone.frequency.linearRampToValueAtTime(2550,at+.06);tone.frequency.linearRampToValueAtTime(2250,at+.16);gain.gain.setValueAtTime(.001,at);gain.gain.linearRampToValueAtTime(.018,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.19);tone.start(at);tone.stop(at+.2);tone.onended=()=>{tone.disconnect();gain.disconnect();};}return true;}catch{return false;}
  },
  suspend(){try{Promise.resolve(context?.suspend()).catch(()=>{});}catch{}},
  dispose(){disposed=true;try{Promise.resolve(context?.close()).catch(()=>{});}catch{}context=null;master=null;crowdBuffer=null;}
 };
}
