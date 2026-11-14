import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceExportRoute } from '../worker/source-download.js';

const bytes = Uint8Array.from({length:257}, (_, i) => i < 4 ? [80,75,3,4][i] : i % 256);
const digest = value => createHash('sha256').update(value).digest('hex');
const token = 'A'.repeat(43), now = Date.UTC(2026,10,14);
const grant = {tokenHash:digest(token),issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),fileName:'Touchline-37-Claude-kildekode.zip',versionCode:37,sourceCommit:'c71fbb7b617e95f23c737dc5a9fc7fc0a206430e',sha256:digest(bytes),bytes:bytes.length};
const objectKey = `source-exports/${grant.sha256}/${grant.fileName}`;
class Bucket {
 objects = new Map(); reads = []; writes = [];
 async put(key,value,options) {
  this.writes.push({key,options});
  assert.deepEqual(options.onlyIf,{etagDoesNotMatch:'*'});
  assert.equal(digest(new Uint8Array(value)),Buffer.from(options.sha256).toString('hex'));
  if(this.objects.has(key))return null;
  const data=new Uint8Array(value).slice(),object={data,size:data.length,customMetadata:{...options.customMetadata}};
  this.objects.set(key,object);return{...object};
 }
 async head(key){this.reads.push({method:'head',key});const o=this.objects.get(key);return o?{size:o.size,customMetadata:o.customMetadata}:null;}
 async get(key,options){
  this.reads.push({method:'get',key,options});const o=this.objects.get(key);if(!o)return null;
  const data=options?.range?o.data.slice(options.range.offset,options.range.offset+options.range.length):o.data;
  return{size:o.size,customMetadata:o.customMetadata,body:new ReadableStream({start(c){c.enqueue(data);c.close();}})};
 }
}
async function route({bucket=new Bucket(),name=grant.fileName,key=token,method='GET',headers={},body,settings=grant,at=now,path}={}){
 const url=new URL('https://site.test'+(path??`/owner-exports/${key}/${name}`));
 const request=new Request(url,{method,headers,...(['GET','HEAD'].includes(method)?{}:{body,duplex:'half'})});
 return{bucket,response:await sourceExportRoute(request,url,bucket,settings,at)};
}
const upload=options=>route({name:'upload.zip',method:'PUT',body:bytes,...options});

function privateHeaders(response){
 assert.match(response.headers.get('Cache-Control'),/private, no-store/);
 assert.match(response.headers.get('X-Robots-Tag'),/noindex/);
 assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
 assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
}

test('source ZIP upload stores only exact approved bytes at an immutable content-addressed key',async()=>{
 const{bucket,response}=await upload({headers:{'Content-Length':String(bytes.length)}});
 assert.equal(response.status,201);privateHeaders(response);assert.equal(await response.text(),'');
 assert.equal(bucket.objects.size,1);assert.deepEqual(bucket.objects.get(objectKey).data,bytes);
 const metadata=bucket.objects.get(objectKey).customMetadata;
 assert.equal(metadata.sha256,grant.sha256);assert.equal(metadata.bytes,String(bytes.length));assert.equal(metadata.sourceCommit,grant.sourceCommit);
 assert.equal(bucket.writes[0].options.httpMetadata.contentType,'application/zip');
 assert.equal(response.headers.get('Location'),null);
});

test('capability, canonical path, expiry and grant schema are checked before any ZIP storage access',async()=>{
 const invalid=[
  {key:'B'.repeat(43)},{key:token.slice(1)},{name:grant.fileName+'/extra'},
  {name:'Touchline-38-Claude-kildekode.zip'},{name:'Touchline-37-Claude-kildekode.apk'},
  {name:'unknown.zip'},{path:'/owner-exports/'+token+'/%2e%2e%2fsecret.zip'},
  {path:'/owner-exports/'+token+'/'+grant.fileName+'/'},
  {at:now-1},{at:now+86400000},{at:NaN},{settings:null},
  {settings:{...grant,issuedAt:'bad'}},{settings:{...grant,expiresAt:'bad'}},
  {settings:{...grant,expiresAt:new Date(now).toISOString()}},
  {settings:{...grant,expiresAt:new Date(now+86400001).toISOString()}},
  {settings:{...grant,tokenHash:'bad'}},{settings:{...grant,sha256:'bad'}},
  {settings:{...grant,sourceCommit:'bad'}},{settings:{...grant,sourceCommit:'a'.repeat(39)}},
  {settings:{...grant,fileName:'../secret.zip'}},
  {settings:{...grant,fileName:'Touchline-37-Claude-kildekode.zip\r\nInjected: yes'}},
  {settings:{...grant,versionCode:38}},
  ...[0,-1,1.5,NaN,33554433].map(size=>({settings:{...grant,bytes:size}})),
 ];
 for(const args of invalid){const{bucket,response}=await route(args);assert.equal(response.status,404,JSON.stringify(args));assert.equal(bucket.reads.length,0);assert.equal(bucket.writes.length,0);}
 const{bucket}=await upload();assert.equal((await route({bucket,at:now+86399999})).response.status,200);
 for(const args of [{key:'B'.repeat(43)},{at:now+86400000},{settings:null},{name:'upload.zip/extra'}]){
  const{bucket,response}=await upload(args);assert.equal(response.status,404);assert.equal(bucket.reads.length,0);assert.equal(bucket.writes.length,0);
 }
});

test('ZIP upload rejects unsupported methods and exact-length/hash violations without writing',async()=>{
 for(const method of ['GET','HEAD','POST','DELETE']){
  const{bucket,response}=await upload({method});assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'PUT');assert.equal(bucket.writes.length,0);
  assert.equal((await upload({method,key:'B'.repeat(43)})).response.status,404);
 }
 for(const args of [{headers:{'Content-Length':'256'}},{headers:{'Content-Length':'258'}},{headers:{'Content-Length':'invalid'}},{body:bytes.slice(1)},{body:new Uint8Array(258)},{body:null}]){
  const{bucket,response}=await upload(args);assert.equal(response.status,400,JSON.stringify(args));assert.equal(bucket.writes.length,0);
 }
 const changed=bytes.slice();changed[0]^=1;const result=await upload({body:changed});assert.equal(result.response.status,422);assert.equal(result.bucket.writes.length,0);
 assert.equal((await upload({headers:{'Content-Length':'33554433'}})).response.status,413);
 let cancelled=false,pulls=0;
 const body=new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(258));},cancel(){cancelled=true;}});
 const streamed=await upload({body});assert.equal(streamed.response.status,400);assert(cancelled);assert(pulls<=2);assert.equal(streamed.bucket.writes.length,0);
});

test('chunked ZIP upload validates fully and immutable retries cannot replace a stored export',async()=>{
 let finished=false;const body=new ReadableStream({start(c){c.enqueue(bytes.slice(0,17));c.enqueue(bytes.slice(17));finished=true;c.close();}});
 const bucket=new Bucket(),put=bucket.put.bind(bucket);bucket.put=(...args)=>{assert(finished);return put(...args);};
 assert.equal((await upload({bucket,body})).response.status,201);const original=bucket.objects.get(objectKey);
 assert.equal((await upload({bucket})).response.status,204);assert.equal(bucket.objects.get(objectKey),original);
 original.customMetadata.sha256='b'.repeat(64);assert.equal((await upload({bucket})).response.status,409);assert.equal(bucket.objects.get(objectKey),original);
});

test('owner ZIP download streams exact bytes with private mobile download headers, HEAD and byte ranges',async()=>{
 const{bucket}=await upload();const full=(await route({bucket})).response;
 assert.equal(full.status,200);privateHeaders(full);assert.equal(full.headers.get('Content-Type'),'application/zip');
 assert.equal(full.headers.get('Content-Disposition'),`attachment; filename="${grant.fileName}"`);
 assert.equal(full.headers.get('Content-Length'),'257');assert.equal(full.headers.get('Accept-Ranges'),'bytes');assert.equal(full.headers.get('ETag'),`"${grant.sha256}"`);
 assert.deepEqual(new Uint8Array(await full.arrayBuffer()),bytes);
 const head=(await route({bucket,method:'HEAD',headers:{Range:'bytes=invalid'}})).response;assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Length'),'257');assert.equal(bucket.reads.at(-1).method,'head');
 for(const[range,start,end]of[['bytes=0-15',0,15],['bytes=240-',240,256],['bytes=-12',245,256],['bytes=250-999',250,256],['bytes=-999',0,256]]){
  const response=(await route({bucket,headers:{Range:range}})).response;assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),`bytes ${start}-${end}/257`);assert.equal(response.headers.get('Content-Length'),String(end-start+1));assert.deepEqual(bucket.reads.at(-1).options,{range:{offset:start,length:end-start+1}});assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes.slice(start,end+1));
 }
});

test('ZIP download fails closed for missing or mismatched objects, invalid ranges and storage outages',async()=>{
 assert.equal((await route()).response.status,404);
 for(const change of[o=>{o.size--;},o=>{o.customMetadata.sha256='b'.repeat(64);},o=>{o.customMetadata.sourceCommit='b'.repeat(40);},o=>{o.customMetadata.bytes='256';},o=>{o.customMetadata={};}]){
  const{bucket}=await upload();change(bucket.objects.get(objectKey));assert.equal((await route({bucket})).response.status,404);assert.equal((await route({bucket,method:'HEAD'})).response.status,404);
 }
 const{bucket}=await upload();
 for(const range of['bytes=257-','bytes=10-1','bytes=-0','bytes=-','bytes=0-1,4-5','bytes=abc','items=0-2','bytes=9007199254740992-']){
  const response=(await route({bucket,headers:{Range:range}})).response;assert.equal(response.status,416,range);assert.equal(response.headers.get('Content-Range'),'bytes */257');
 }
 for(const method of['POST','PUT','DELETE']){const before=bucket.reads.length;const response=(await route({bucket,method})).response;assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'GET, HEAD');assert.equal(bucket.reads.length,before);}
 assert.equal((await route({bucket:null})).response.status,503);assert.equal((await upload({bucket:null})).response.status,503);
 assert.equal((await route({bucket:{get(){throw Error('offline');},head(){throw Error('offline');}}})).response.status,503);
 assert.equal((await upload({bucket:{head(){},put(){throw Error('offline');}}})).response.status,503);
});

test('source ZIP route leaves APK delivery, public release gates and unrelated routes untouched',async()=>{
 const bucket=new Bucket();for(const path of['/','/play','/api/game','/downloads/Touchline-1.0.0.apk',`/owner-builds/${token}/Touchline-1.0.0-37.apk`,`/owner-builds/${token}/upload.apk`])assert.equal((await route({bucket,path})).response,null,path);
 assert.equal(bucket.reads.length,0);assert.equal(bucket.writes.length,0);
});
