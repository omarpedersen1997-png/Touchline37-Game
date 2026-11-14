// Local-only release draft. This entry is never built into dist/server/index.js.
import gamePage from '../generated-web-game.js';
import publicWorker from './index.js';
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(['/play','/privacy','/delete-account','/contact'].includes(url.pathname)){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
  return new Response(request.method==='HEAD'?null:gamePage,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
 }
 return publicWorker.fetch(request,env);
}};
