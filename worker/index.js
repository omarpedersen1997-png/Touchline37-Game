import captures from'../generated-site-captures.js';
import{touchlineMarkSvg}from'../shared/brand-mark.js';
import{applySiteHead,publicSitePaths}from'../shared/site-metadata.js';
import{privateApkUploadRoute,storedApkResponse}from'./artifact-storage.js';
import{privateApkRoute}from'./private-download.js';
import ownerApk from'../release/owner-apk.json' with {type:'json'};
import downloadArtifact from'../release/downloads/current.json' with {type:'json'};
import {launchInfo} from './launch.js';
import gamePage from '../generated-launch-game.js';
import launchApk from '../generated-launch-apk.js';
import siteArt from '../generated-site-art.js';
import {ExpansionError} from './expansion.js';
import {EuropeError} from './europe.js';
import {ClubStyleError} from './clubstyle.js';
import {GameError} from './management.js';
import {contactRoute} from './contact.js';
import {authRoute,authenticatedUser,AuthError,validOrigin} from './auth.js';
import {createGame,accrue,settle,apply,publicState} from './game.js';
import page from '../generated-page.js';
import {matchVersionInfo} from '../shared/engine-versions.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function imageBytes(value){if(typeof Uint8Array.fromBase64==='function')return Uint8Array.fromBase64(value);const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
export default {async fetch(request,env){
 const url=new URL(request.url);
 const uploaded=await privateApkUploadRoute(request,url,env.BUCKET,downloadArtifact,ownerApk);if(uploaded)return uploaded;
 const privateBuild=await privateApkRoute(request,url,env.BUCKET||launchApk,downloadArtifact,ownerApk);if(privateBuild)return privateBuild;
 const launch=launchInfo();
 const releaseHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(url.pathname==='/api/launch'){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...releaseHeaders,Allow:'GET, HEAD'}});
  return new Response(request.method==='HEAD'?null:JSON.stringify(launch),{headers:{...releaseHeaders,'Content-Type':'application/json; charset=utf-8'}});
 }
 if(url.pathname==='/play'){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...releaseHeaders,Allow:'GET, HEAD'}});
  if(!launch.open)return new Response(request.method==='HEAD'?null:'Ikke fundet',{status:404,headers:releaseHeaders});
  return new Response(request.method==='HEAD'?null:gamePage,{headers:{...releaseHeaders,'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'same-origin'}});
 }
 if(url.pathname===launch.apkUrl||url.pathname==='/downloads/touchline.apk'){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...releaseHeaders,Allow:'GET, HEAD'}});
  if(!launch.open)return new Response(request.method==='HEAD'?null:'Ikke fundet',{status:404,headers:releaseHeaders});
  if(env.BUCKET||!launchApk)return storedApkResponse(request,env.BUCKET,{...downloadArtifact,bytes:ownerApk.bytes},ownerApk.fileName,{downloadFileName:'Touchline-'+launch.apkVersion+'.apk',headers:releaseHeaders});
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(launchApk),c=>c.charCodeAt(0)),{headers:{...releaseHeaders,'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="Touchline-'+launch.apkVersion+'.apk"','X-Robots-Tag':'noindex'}});
 }
 if(url.pathname.startsWith('/downloads/'))return new Response(request.method==='HEAD'?null:'Ikke fundet',{status:404,headers:releaseHeaders});

 if(url.pathname==='/assets/touchline-share.png'){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  return new Response(request.method==='HEAD'?null:imageBytes(siteArt.share),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
 }
 if(Object.hasOwn(captures,url.pathname)){
  const item=captures[url.pathname];
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  return new Response(request.method==='HEAD'?null:imageBytes(item.base64),{headers:{'Content-Type':item.contentType,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Length':String(item.bytes),ETag:'\"'+item.sha256+'\"'}});
 }
 const illustration=/^\/assets\/(arena-2|kit-2|badge-2)\.svg$/.exec(url.pathname);if(illustration){if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(siteArt[illustration[1]]),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"}});}
 if(url.pathname==='/api/contact')return contactRoute(request,env);
 if(url.pathname.startsWith('/api/auth/'))return authRoute(request,env);
 if(url.pathname==='/api/game'){
  if(request.method==='POST'&&!validOrigin(request))return json({error:'Ugyldig forespørgsel.'},403);
  let account;try{account=await authenticatedUser(request,env)}catch(error){return json({error:error instanceof AuthError?error.message:'Login er midlertidigt utilgængeligt.'},503)}
  if(!account)return json({error:'Log ind med din e-mail for at spille.'},401);
  const user=account.id;
  if(!['GET','POST'].includes(request.method))return json({error:'Metoden er ikke understøttet.'},405);
  if(!env.DB)return json({error:'Klubbens database er ikke tilgængelig. Prøv igen om lidt.'},503);
  try {
   let action=null;
   if(request.method==='POST'){if(Number(request.headers.get('content-length'))>16384)return json({error:'For stor forespørgsel.'},413);const text=await request.text();if(text.length>16384)return json({error:'For stor forespørgsel.'},413);try{action=JSON.parse(text)}catch{return text.length>4096?json({error:'For stor forespørgsel.'},413):json({error:'Ugyldig handling.'},400)}if(text.length>4096&&!['manual-match-finish','player-career-manual-finish'].includes(action?.type))return json({error:'For stor forespørgsel.'},413);if(!action||typeof action!=='object'||Array.isArray(action))return json({error:'Ugyldig handling.'},400);}
   for(let attempt=0;attempt<8;attempt++){
    const now=Date.now();let row=await env.DB.prepare('SELECT state, version FROM clubs WHERE user_id = ?').bind(user).first();
    if(!row){await env.DB.prepare('INSERT OR IGNORE INTO clubs (user_id,state,version) SELECT ?,?,0 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?)').bind(user,JSON.stringify(createGame(now)),user).run();continue;}
    const state=JSON.parse(row.state);const offline=accrue(state,now);let result=settle(state,now);
    if(action){const outcome=apply(state,action,now);if(outcome?.manualResult)result=outcome.manualResult;}
    state.version=row.version+1;
    const saved=await env.DB.prepare('UPDATE clubs SET state = ?, version = ? WHERE user_id = ? AND version = ? AND EXISTS (SELECT 1 FROM accounts WHERE id = ?)').bind(JSON.stringify(state),state.version,user,row.version,user).run();
    if(saved.meta.changes===1)return json({state:publicState(state,now),offline:offline.seconds>=60?offline:null,result,matchVersions:matchVersionInfo()});
   }
   return json({error:'Klubben blev opdateret i en anden fane. Prøv igen.'},409);
  }catch(error){const expected=error instanceof GameError||error instanceof EuropeError||error instanceof ExpansionError||error instanceof ClubStyleError||/Akademi|sælges|penge|kamp|Klubnavn|Klubnavnet|handling|opgradering|Spiller|Spiller|Spilleren|trup|tilgængelig|position|taktik|Mission/.test(error.message);return json({error:expected?error.message:'Kunne ikke gemme klubben. Prøv igen.'},expected?400:500);}
 }
 if(url.pathname==='/favicon.svg')return new Response(touchlineMarkSvg(),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=86400'}});
 if(url.pathname==='/robots.txt')return new Response('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /play\nDisallow: /owner-builds/\nSitemap: https://playtouchline.dk/sitemap.xml\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
 if(url.pathname==='/sitemap.xml')return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+publicSitePaths.map(path=>'<url><loc>https://playtouchline.dk'+path+'</loc></url>').join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});
 if(!['/','/privacy','/delete-account','/contact'].includes(url.pathname))return new Response('Ikke fundet',{status:404});
 return new Response(applySiteHead(page,url.pathname),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}};
