// Isolated capture runtime. Never bundled into the production Worker.
// Serves the exact signed APK web UI and the real Worker API with a temporary
// SQLite database; no production account or cloud data is involved.
import https from'node:https';
import{readFileSync}from'node:fs';
import{randomBytes}from'node:crypto';
import worker from'../dist/server/index.js';
import{database}from'../tests/database.mjs';
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
const html=readFileSync(value('--html')),port=Number(value('--port')||4321),db=database(false);
const env={DB:db,AUTH_PEPPER:randomBytes(48).toString('hex')};
const server=https.createServer({key:readFileSync(value('--key')),cert:readFileSync(value('--cert'))},async(req,res)=>{
 try{
  const url=new URL(req.url,`https://127.0.0.1:${port}`);
  if(['/','/privacy','/contact','/delete-account'].includes(url.pathname)){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:html);return;
  }
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('Capture server request failed:',error.message);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Capture runtime failed.'}));}
});
server.listen(port,'127.0.0.1',()=>console.log('APP_CAPTURE_READY '+port));
for(const signal of['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.sqlite.close();process.exit(0);}));
