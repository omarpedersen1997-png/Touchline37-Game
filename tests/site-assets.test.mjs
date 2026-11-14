import{beforeLaunch}from'./launch-clock.mjs';
import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import worker from'../dist/server/index.js';
import{SCREENSHOTS}from'../src/site-gallery-data.js';
import captures from'../generated-site-captures.js';
test('current 4K captures are served byte-for-byte with their verified dimensions and safe read-only headers',async()=>{
 for(const [path,item]of Object.entries(captures)){
  const response=await worker.fetch(new Request('https://site.test'+path),{}),original=readFileSync(new URL('../assets/site/captures/'+path.split('/').pop(),import.meta.url));
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),item.contentType);assert.equal(Number(response.headers.get('Content-Length')),original.length);
  assert.equal(response.headers.get('ETag'),'"'+item.sha256+'"');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.deepEqual(Buffer.from(await response.arrayBuffer()),original);
  const head=await worker.fetch(new Request('https://site.test'+path,{method:'HEAD'}),{});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(Number(head.headers.get('Content-Length')),original.length);
  for(const method of ['POST','PUT','DELETE'])assert.equal((await worker.fetch(new Request('https://site.test'+path,{method}),{})).status,405);
 }
 assert.equal((await worker.fetch(new Request('https://site.test/assets/captures/unknown.jpg'),{})).status,404);
});
test('old low-resolution screenshots and legacy raster art are unavailable publicly',async()=>{
 for(const shot of SCREENSHOTS)for(const method of ['GET','HEAD'])assert.equal((await worker.fetch(new Request('https://site.test'+shot.src,{method}),{})).status,404);
 assert.equal((await worker.fetch(new Request('https://site.test/assets/stadium.png'),{})).status,404);
});
test('public app illustrations are exact static SVG assets with constrained content policy',async()=>{for(const name of['arena-2','kit-2','badge-2']){const url='https://site.test/assets/'+name+'.svg';const r=await worker.fetch(new Request(url),{});assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/image\/svg\+xml/);assert.match(r.headers.get('Content-Security-Policy'),/default-src 'none'/);const svg=await r.text();assert.equal(svg,readFileSync(new URL('../assets/site/'+name+'.svg',import.meta.url),'utf8'));assert(!/<script|foreignObject|onload=|onerror=|href=/i.test(svg));const head=await worker.fetch(new Request(url,{method:'HEAD'}),{});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal((await worker.fetch(new Request(url,{method:'POST'}),{})).status,405)}});
test('showcase keeps game and unreleased downloads closed',async()=>{const r=await worker.fetch(new Request('https://site.test/'),{});const html=await r.text();for(const text of['Klubuniverset','Aurora Europa Cup','spillerkarriere','simuleres','Kommer snart'])assert(html.toLowerCase().includes(text.toLowerCase()));assert(!/Test-APK|testversion|testappen|APK-test|klar til test/i.test(html));assert(!html.includes('/api/game'));assert(!html.includes('/api/auth/login'));assert.equal((await beforeLaunch(()=>worker.fetch(new Request('https://site.test/play'),{}))).status,404);assert.equal((await worker.fetch(new Request('https://site.test/assets/not-present.svg'),{})).status,404)});
