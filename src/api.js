import{Capacitor,registerPlugin}from'@capacitor/core';
import{requestWithRetry,NetworkError,OFFLINE_MESSAGE}from'./network.js';
const NativeApi=registerPlugin('TouchlineApi');
export const isAndroid=()=>Capacitor.getPlatform()==='android';
const NATIVE_TIMEOUTS={GET:40000,POST:40000};// Android-broen har selv 15 s + 20 s; JS-grænsen ligger over den.
let nativeSequence=0;
const nativeRequestId=()=>globalThis.crypto?.randomUUID?.()||'native-'+Date.now().toString(36)+'-'+(++nativeSequence);
export async function apiFetch(path,options={}){
 const method=options.method||'GET',body=options.body||null;
 if(!isAndroid()){
  return requestWithRetry(signal=>fetch(path,{credentials:'same-origin',cache:'no-store',...options,signal}),{path,method,body,signal:options.signal});
 }
 if(!/^\/api\/(auth\/(me|register|login|logout|delete|capabilities|change-password|change-email|request-verification|verify-email|request-reset|reset-password)|game|contact)$/.test(path))throw Error('Ukendt apphandling.');
 return requestWithRetry(async signal=>{
  const requestId=nativeRequestId();let sent=false;
  const cancel=()=>{if(!sent)return;try{Promise.resolve(NativeApi.cancel?.({requestId})).catch(()=>{});}catch{}};
  signal.addEventListener('abort',cancel,{once:true});
  let response;try{
   if(signal.aborted)throw signal.reason??new DOMException('Aborted','AbortError');
   sent=true;response=await NativeApi.request({path,method,body,requestId});
   if(signal.aborted)throw signal.reason??new DOMException('Aborted','AbortError');
  }catch(error){if(signal.aborted)throw signal.reason??new DOMException('Aborted','AbortError');if(error?.code==='REQUEST_CANCELLED')throw new DOMException('Aborted','AbortError');if(error?.code==='REQUEST_TOO_LARGE'){error.status=413;error.retryable=false;throw error;}throw new NetworkError(error?.message||OFFLINE_MESSAGE,{cause:error});}
  finally{signal.removeEventListener('abort',cancel);}
  const text=response.body??'';let json=true;if(text){try{JSON.parse(text)}catch{json=false}}
  // Et ikke-JSON-svar (fx en fejlside) bliver til en læsbar fejl i stedet for et nedbrud.
  if(!json)return new Response(JSON.stringify({error:OFFLINE_MESSAGE}),{status:response.status>=200&&response.status<300?502:response.status,headers:{'Content-Type':'application/json'}});
  return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json'}});
 },{path,method,body,signal:options.signal,timeouts:NATIVE_TIMEOUTS});
}

export const webGame=typeof __WEB_GAME__!=='undefined'&&__WEB_GAME__;
export function resolveGameHome({native=false,web=false,search=''}={}){return native?'/':web||new URLSearchParams(search).get('from')==='play'?'/play':'/'}
export const gameHome=resolveGameHome({native:isAndroid(),web:webGame,search:typeof location!=='undefined'?location.search:''});
// Only the fixed game return marker is carried through public document pages.
// No arbitrary redirect URL or account information is placed in the query.
export function documentLink(path,home=gameHome){
 if(home!=='/play'||typeof path!=='string')return path;
 const hashIndex=path.indexOf('#'),hash=hashIndex<0?'':path.slice(hashIndex),base=hashIndex<0?path:path.slice(0,hashIndex);
 const queryIndex=base.indexOf('?'),pathname=queryIndex<0?base:base.slice(0,queryIndex);
 if(!['/privacy','/contact','/delete-account'].includes(pathname))return path;
 const query=new URLSearchParams(queryIndex<0?'':base.slice(queryIndex+1));query.set('from','play');return pathname+'?'+query.toString()+hash;
}
if(typeof document!=='undefined'){
 if(isAndroid())document.documentElement.classList.add('native-android');
 else if(webGame)document.documentElement.classList.add('web-game');
}
