import{Capacitor,registerPlugin}from'@capacitor/core';
const NativeApi=registerPlugin('TouchlineApi');
export const isAndroid=()=>Capacitor.getPlatform()==='android';
export async function apiFetch(path,options={}){
 if(!isAndroid()){try{return await fetch(path,{credentials:'same-origin',cache:'no-store',...options})}catch(error){if(error?.name==='AbortError')throw error;throw Error('Forbindelsen til klubben blev afbrudt. Tjek dit internet, og prøv igen.')}}
 if(!/^\/api\/(auth\/(me|register|login|logout|delete|capabilities|change-password|change-email|request-verification|verify-email|request-reset|reset-password)|game|contact)$/.test(path))throw Error('Ukendt apphandling.');
 let response;try{response=await NativeApi.request({path,method:options.method||'GET',body:options.body||null});}catch(error){if(error?.code==='REQUEST_TOO_LARGE'){error.status=413;error.retryable=false;}throw error;}
 return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json'}});
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
