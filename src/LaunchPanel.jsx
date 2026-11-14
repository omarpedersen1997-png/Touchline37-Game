import React,{useEffect,useState}from'react';
import plan from'../release/launch.json';

export function countdownParts(opensAt,now){const remaining=Math.max(0,Math.ceil((Date.parse(opensAt)-now)/1000));return{days:Math.floor(remaining/86400),hours:Math.floor(remaining/3600)%24,minutes:Math.floor(remaining/60)%60,seconds:remaining%60,remaining}}
export function validLaunchStatus(value){return !!value&&typeof value.open==='boolean'&&value.opensAt===plan.opensAt&&Number.isFinite(value.serverTime)&&value.playUrl==='/play'&&/^\/downloads\/Touchline-\d+\.\d+\.\d+\.apk$/.test(value.apkUrl)&&value.apkVersion===plan.apkVersion}

export function useLaunchStatus(){
 const[clock,setClock]=useState(()=>Date.now()),[sync,setSync]=useState({status:null,offset:0,error:false});
 useEffect(()=>{
  let alive=true,timer,controller,sequence=0;
  async function refresh(){
   const request=++sequence,start=Date.now();controller?.abort();controller=new AbortController();const current=controller;
   const timeout=setTimeout(()=>current.abort(),8000);let delay=15000;
   try{
    const r=await fetch('/api/launch',{cache:'no-store',signal:current.signal});if(!r.ok)throw Error();
    const data=await r.json();if(!validLaunchStatus(data))throw Error();const end=Date.now();if(!alive||request!==sequence)return;
    setSync({status:data,offset:data.serverTime-(start+end)/2,error:false});
    delay=data.open?60000:Math.max(1000,Math.min(15000,Date.parse(data.opensAt)-data.serverTime));
   }catch(error){if(!alive||request!==sequence)return;setSync(value=>({...value,error:true}));delay=5000}
   finally{clearTimeout(timeout)}
   if(alive&&request===sequence)timer=setTimeout(refresh,delay);
  }
  refresh();const tick=setInterval(()=>setClock(Date.now()),1000);const wake=()=>{if(!document.hidden){setClock(Date.now());clearTimeout(timer);refresh()}};document.addEventListener('visibilitychange',wake);
  return()=>{alive=false;controller?.abort();clearTimeout(timer);clearInterval(tick);document.removeEventListener('visibilitychange',wake)};
 },[]);
 return{...sync,now:clock+sync.offset};
}
export default function LaunchPanel({release,compact=false}){
 const{status,error,now}=release;const open=!!status?.open&&!error;const left=countdownParts(status?.opensAt||plan.opensAt,now);const waiting=left.remaining===0&&!open;
 return <section className={'launch-panel '+(compact?'compact':'')} aria-label="Åbning af Android og webspil"><p className="launch-date" role="status">{open?'KLUBHUSET ER ÅBENT':plan.label+' · dansk tid'}</p>{!compact&&!open&&<><div className="launch-countdown" role="timer" aria-label="Tid til åbning" aria-live="off">{[[left.days,'Dage'],[left.hours,'Timer'],[left.minutes,'Min.'],[left.seconds,'Sek.']].map(([n,label])=><div key={label}><b>{String(n).padStart(2,'0')}</b><span>{label}</span></div>)}</div><p className="launch-note">{error?'Vi kan ikke bekræfte åbningen lige nu. Siden prøver automatisk igen.':waiting?'Vi bekræfter åbningen — et øjeblik…':'Android-download og webversion åbner samtidig.'}</p></>}{open?<div className="launch-actions"><a className="primary" href={status.apkUrl} download>Download til Android<span aria-hidden="true">↓</span></a><a className="launch-web" href={status.playUrl}>Spil i browseren<span aria-hidden="true">↗</span></a></div>:<div className="launch-platforms"><span>ANDROID APK<b>Kommer snart</b></span><span>WEBVERSION<b>Kommer snart</b></span></div>}<span className="launch-play-note">Google Play · Kommer senere</span></section>
}
