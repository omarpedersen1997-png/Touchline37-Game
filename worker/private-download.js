// Expiring capability for the owner to retrieve an exact pre-release build.
// The random capability is never committed or advertised on the public site.
import{approvedPrivateGrant,PRIVATE_APK_HEADERS,storedApkResponse}from'./artifact-storage.js';
const headers=PRIVATE_APK_HEADERS;
const missing=()=>new Response(null,{status:404,headers});
export async function privateApkRoute(request,url,base64,artifact,grant,now=Date.now()){
 if(!url.pathname.startsWith('/owner-builds/'))return null;
 if(!await approvedPrivateGrant(url,artifact,grant,now,grant?.fileName))return missing();
 // The string source remains supported for existing packaged Worker builds.
 // Production can pass env.BUCKET instead, keeping APK bytes out of the Worker.
 if(base64&&typeof base64==='object')return storedApkResponse(request,base64,{...artifact,bytes:grant.bytes},grant.fileName);
 if(typeof base64!=='string')return missing();
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const size=base64.length/4*3-(base64.endsWith('==')?2:base64.endsWith('=')?1:0);if(!Number.isSafeInteger(size)||size<=0||size!==grant.bytes)return missing();
 const responseHeaders={...headers,'Content-Type':'application/vnd.android.package-archive','Content-Disposition':`attachment; filename="${grant.fileName}"`,'Accept-Ranges':'bytes','Content-Length':String(size),ETag:`"${grant.sha256}"`};
 if(request.method==='HEAD')return new Response(null,{headers:responseHeaders});
 let start=0,end=size-1,status=200;const range=request.headers.get('Range');
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range),invalid=()=>new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${size}`}});if(!match||(!match[1]&&!match[2]))return invalid();if(match[1]){start=Number(match[1]);end=match[2]?Number(match[2]):size-1;}else{const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return invalid();start=Math.max(0,size-suffix);}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return invalid();end=Math.min(end,size-1);status=206;responseHeaders['Content-Range']=`bytes ${start}-${end}/${size}`;responseHeaders['Content-Length']=String(end-start+1);
 }
 const binary=atob(base64),body=new Uint8Array(end-start+1);for(let i=start;i<=end;i++)body[i-start]=binary.charCodeAt(i);
 return new Response(body,{status,headers:responseHeaders});
}
