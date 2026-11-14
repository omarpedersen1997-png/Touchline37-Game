// A separate, expiring owner capability serves one approved source ZIP.
// Source files never become public site assets or share the APK capability.
import{PRIVATE_APK_HEADERS,MAX_APK_BYTES,byteRange,exactBody}from'./artifact-storage.js';
const headers=PRIVATE_APK_HEADERS,sha256=/^[a-f0-9]{64}$/,commit=/^[a-f0-9]{40}$/;
const hex=bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
const response=status=>new Response(null,{status,headers});
function validGrant(grant,now){
 const issued=Date.parse(grant?.issuedAt),expires=Date.parse(grant?.expiresAt);
 return Number.isFinite(now)&&Number.isFinite(issued)&&Number.isFinite(expires)&&expires>issued&&expires-issued<=86400000&&now>=issued&&now<expires&&
  Number.isSafeInteger(grant?.versionCode)&&grant.versionCode>0&&grant.fileName===`Touchline-${grant.versionCode}-Claude-kildekode.zip`&&
  sha256.test(grant?.tokenHash||'')&&sha256.test(grant?.sha256||'')&&commit.test(grant?.sourceCommit||'')&&
  Number.isSafeInteger(grant?.bytes)&&grant.bytes>0&&grant.bytes<=MAX_APK_BYTES;
}
const matches=(object,grant)=>!!object&&object.size===grant.bytes&&object.customMetadata?.sha256===grant.sha256&&object.customMetadata?.bytes===String(grant.bytes)&&object.customMetadata?.sourceCommit===grant.sourceCommit;

export async function sourceExportRoute(request,url,bucket,grant,now=Date.now()){
 if(!url.pathname.startsWith('/owner-exports/'))return null;
 const parts=url.pathname.split('/');
 if(parts.length!==4||!/^[A-Za-z0-9_-]{43}$/.test(parts[2])||!validGrant(grant,now)||![grant.fileName,'upload.zip'].includes(parts[3]))return response(404);
 const tokenHash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(parts[2])));
 let difference=0;for(let i=0;i<64;i++)difference|=tokenHash.charCodeAt(i)^grant.tokenHash.charCodeAt(i);
 if(difference)return response(404);
 const key=`source-exports/${grant.sha256}/${grant.fileName}`;
 if(parts[3]==='upload.zip'){
  if(request.method!=='PUT')return new Response(null,{status:405,headers:{...headers,Allow:'PUT'}});
  if(!bucket||typeof bucket.put!=='function'||typeof bucket.head!=='function')return response(503);
  const length=request.headers.get('Content-Length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==grant.bytes))return response(Number(length)>MAX_APK_BYTES?413:400);
  const bytes=await exactBody(request,grant.bytes);if(!bytes)return response(400);
  const digest=await crypto.subtle.digest('SHA-256',bytes);if(hex(digest)!==grant.sha256)return response(422);
  try{
   const object=await bucket.put(key,bytes.buffer,{onlyIf:{etagDoesNotMatch:'*'},sha256:digest,httpMetadata:{contentType:'application/zip'},customMetadata:{sha256:grant.sha256,bytes:String(grant.bytes),sourceCommit:grant.sourceCommit}});
   if(!object)return response(matches(await bucket.head(key),grant)?204:409);
   return response(201);
  }catch{return response(503);}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 if(!bucket||typeof bucket.get!=='function'||typeof bucket.head!=='function')return response(503);
 const range=byteRange(request.method==='HEAD'?null:request.headers.get('Range'),grant.bytes);
 if(!range)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${grant.bytes}`}});
 let object;
 try{object=request.method==='HEAD'?await bucket.head(key):await bucket.get(key,range.status===206?{range:{offset:range.start,length:range.end-range.start+1}}:undefined);}catch{return response(503);}
 if(!matches(object,grant)||(request.method!=='HEAD'&&!object.body)){if(object?.body)await object.body.cancel().catch(()=>{});return response(404);}
 const downloadHeaders={...headers,'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${grant.fileName}"`,'Accept-Ranges':'bytes','Content-Length':String(range.end-range.start+1),ETag:`"${grant.sha256}"`};
 if(range.status===206)downloadHeaders['Content-Range']=`bytes ${range.start}-${range.end}/${grant.bytes}`;
 return new Response(request.method==='HEAD'?null:object.body,{status:range.status,headers:downloadHeaders});
}
