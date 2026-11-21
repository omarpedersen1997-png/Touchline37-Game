const key='touchline:match-sound:v1';
export function createMatchSound({storage,Audio=globalThis.AudioContext||globalThis.webkitAudioContext,hidden=()=>globalThis.document?.hidden}={}) {
 let context=null,master=null,disposed=false,enabled=false;
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
  suspend(){try{Promise.resolve(context?.suspend()).catch(()=>{});}catch{}},
  dispose(){disposed=true;try{Promise.resolve(context?.close()).catch(()=>{});}catch{}context=null;master=null;}
 };
}
