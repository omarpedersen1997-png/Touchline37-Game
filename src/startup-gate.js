export function startupSplashEnabled(storage){try{return storage?.getItem('touchline:startup-splash')!=='off';}catch{return true;}}
export function saveStartupSplashPreference(enabled,storage){try{storage?.setItem('touchline:startup-splash',enabled?'on':'off');}catch{}}
export function createStartupGate({onFade,onDone,now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,reducedMotion=false}={}){
 const started=now(),timers=new Set();let closing=false,disposed=false;
 const later=(fn,ms)=>{const timer=setTimer(()=>{timers.delete(timer);if(!disposed)fn();},ms);timers.add(timer);};
 const close=(quick=false)=>{if(disposed||closing)return;closing=true;for(const timer of timers)clearTimer(timer);timers.clear();onFade?.({quick});later(()=>onDone?.(),reducedMotion?0:quick?80:160);};
 later(()=>close(),1340);
 return{ready(){if(!closing&&!disposed)later(()=>close(),Math.max(0,1000-(now()-started)));},skip(){close(true);},dispose(){disposed=true;for(const timer of timers)clearTimer(timer);timers.clear();}};
}
