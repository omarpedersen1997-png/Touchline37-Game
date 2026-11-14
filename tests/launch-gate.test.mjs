import{test}from'node:test';import assert from'node:assert/strict';
import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import schedule from'../release/launch.json' with{type:'json'};
import ownerApk from'../release/owner-apk.json' with{type:'json'};
import download from'../release/downloads/current.json' with{type:'json'};
import{launchInfo,validLaunch}from'../worker/launch.js';
import worker from'../dist/server/index.js';
import{database,TEST_PEPPER}from'./database.mjs';

const approvedBytes=readFileSync(new URL('../release/downloads/'+download.apk,import.meta.url));
const bucket={async head(){return{size:approvedBytes.length,customMetadata:{sha256:download.sha256}}},async get(_key,opts){const start=opts?.range?.offset||0,end=opts?.range?start+opts.range.length:approvedBytes.length;return{size:approvedBytes.length,customMetadata:{sha256:download.sha256},body:new Response(approvedBytes.subarray(start,end)).body}}};
const serve=(request,env={})=>worker.fetch(request,{BUCKET:bucket,...env});
const origin='https://release.test',opens=Date.parse(schedule.opensAt),apk=`/downloads/Touchline-${schedule.apkVersion}.apk`;
const request=(path,method='GET',headers={})=>new Request(origin+path,{method,headers});
const at=async(time,run)=>{const real=Date.now;Date.now=()=>time;try{return await run()}finally{Date.now=real}};
const digest=data=>createHash('sha256').update(data).digest('hex');

test('launch uses 1 January 2027 at 10:00 Copenhagen time and closes on invalid schedule or clock',()=>{
 assert.equal(schedule.opensAt,'2027-01-01T09:00:00.000Z');
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',weekday:'long',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(opens));
 assert.equal(parts.find(p=>p.type==='weekday').value,'Friday');assert.equal(parts.find(p=>p.type==='hour').value,'10');assert.equal(parts.find(p=>p.type==='minute').value,'00');
 assert.equal(launchInfo(opens-1).open,false);assert.equal(launchInfo(opens).open,true);assert.equal(launchInfo(opens+1).open,true);assert.equal(launchInfo(NaN).open,false);assert.equal(launchInfo(Infinity).open,false);
 for(const settings of[null,{}, {...schedule,opensAt:'nonsense'},{...schedule,opensAt:'2026-11-31T09:00:00.000Z'},{...schedule,timeZone:'UTC'},{...schedule,apkVersion:'../../secret'},{...schedule,apkVersion:'0.0.0'}]){assert.equal(validLaunch(settings),false);assert.equal(launchInfo(opens+1,settings).open,false)}
});

test('postponement keeps both versions closed on the former launch date and across New Year midnight',async()=>{
 for(const time of ['2026-11-13T09:00:00.000Z','2026-12-31T23:00:00.000Z','2027-01-01T08:59:59.999Z'])await at(Date.parse(time),async()=>{
  for(const path of ['/play',apk,'/downloads/touchline.apk'])assert.equal((await serve(request(path),{})).status,404,path+' at '+time);
  const status=await(await serve(request('/api/launch'),{})).json();
  assert.equal(status.open,false);assert.equal(status.opensAt,schedule.opensAt);
 });
});

test('before opening, routes stay closed and no client clock, query or environment override bypasses the server',async()=>at(opens-1,async()=>{
 for(const path of['/play',apk,'/downloads/touchline.apk',`/play?now=${opens+1}&preview=1&open=true`]){
  const r=await serve(request(path,'GET',{'X-Launch-Preview':'true',Date:new Date(opens+1000).toUTCString()}),{LAUNCH_AT:0,LAUNCH_OPEN:true});
  assert.equal(r.status,404,path);assert.equal(r.headers.get('Cache-Control'),'no-store');assert(!(await r.text()).includes('/api/game'));
 }
 const html=await(await serve(request('/'),{})).text();assert(!html.includes('/api/game'));assert(!html.includes('/api/auth/login'));
 const status=await serve(request('/api/launch'),{});assert.equal(status.status,200);assert.equal(status.headers.get('Cache-Control'),'no-store');assert.deepEqual(await status.json(),{open:false,opensAt:schedule.opensAt,timeZone:'Europe/Copenhagen',apkVersion:schedule.apkVersion,playUrl:'/play',apkUrl:apk,serverTime:opens-1});
}));

test('at the exact boundary the playable page opens without changing API authentication',async()=>at(opens,async()=>{
 const r=await serve(request('/play'),{});assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/text\/html/);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow');
 const html=await r.text();assert(html.includes('/api/game'));assert(html.includes('/api/auth/'));assert(html.includes('Opret min klub'));assert(!html.includes('omarpedersen1997'));
 const env={DB:database(false),AUTH_PEPPER:TEST_PEPPER};assert.equal((await serve(request('/api/game'),env)).status,401);assert.equal(env.DB.clubCount(),0);
 const meta=await(await serve(request('/api/launch'),{})).json();assert.equal(meta.open,true);assert.equal(meta.serverTime,opens);
 const homepage=await(await serve(request('/'),{})).text();assert(!homepage.includes('/api/game'));assert(!homepage.includes('/api/auth/login'));
}));

test('released APK bytes and clean filename match the approved local artifact; old and unknown releases stay closed',async()=>at(opens+1,async()=>{
 const local=readFileSync(new URL('../release/downloads/'+download.apk,import.meta.url));
 for(const path of[apk,'/downloads/touchline.apk']){
  const r=await serve(request(path),{});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('Content-Type'),'application/vnd.android.package-archive');assert.equal(r.headers.get('Content-Disposition'),`attachment; filename="Touchline-${schedule.apkVersion}.apk"`);assert.equal(digest(new Uint8Array(await r.arrayBuffer())),digest(local));
 }
 for(const path of[`/downloads/Touchline-${schedule.apkVersion}-test.apk`,'/downloads/Touchline-0.0.0.apk','/downloads/Touchline-999.9.9.apk','/downloads/touchline-test.apk',`/downloads/${download.archive}`,'/downloads/touchline-play-package.zip'])assert.equal((await serve(request(path),{})).status,404,path);
}));

test('HEAD and method handling work before and after release without cacheable locked responses',async()=>{
 for(const time of[opens-1,opens,opens+1])await at(time,async()=>{
  for(const path of['/play',apk,'/downloads/touchline.apk','/api/launch']){
   const head=await serve(request(path,'HEAD'),{});assert.equal(head.status,path==='/api/launch'||time>=opens?200:404);assert.equal(await head.text(),'');assert.equal(head.headers.get('Cache-Control'),'no-store');
   for(const method of['POST','PUT','DELETE']){const response=await serve(request(path,method),{});assert.equal(response.status,405);assert.equal(response.headers.get('Cache-Control'),'no-store')}
  }
 });
});
