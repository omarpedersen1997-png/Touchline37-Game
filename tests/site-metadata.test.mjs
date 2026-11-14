import{test}from'node:test';
import assert from'node:assert/strict';
import{siteHead,publicSitePaths}from'../shared/site-metadata.js';
import{touchlineMarkSvg,BRAND_MARK}from'../shared/brand-mark.js';
import worker from'../dist/server/index.js';

test('each public document exposes one canonical URL and complete sharing metadata',async()=>{
 for(const path of publicSitePaths){
  const response=await worker.fetch(new Request('https://site.test'+path),{}),html=await response.text(),head=html.slice(0,html.indexOf('</head>'));
  assert.equal(response.status,200);assert(head.includes(siteHead(path)));
  assert.equal((head.match(/rel="canonical"/g)||[]).length,1);
  assert.equal((head.match(/<title>/g)||[]).length,1);
  for(const key of['og:title','og:description','og:url','og:image','og:image:width','og:image:height'])assert(head.includes(`property="${key}"`),key);
  assert(head.includes('content="3840"'));assert(head.includes('content="2160"'));assert(head.includes('summary_large_image'));
 }
});
test('search indexing documents list public information and exclude game, API and private build links',async()=>{
 const robots=await(await worker.fetch(new Request('https://site.test/robots.txt'),{})).text();assert(robots.includes('Disallow: /play'));assert(robots.includes('Disallow: /api/'));assert(robots.includes('Disallow: /owner-builds/'));
 const sitemap=await(await worker.fetch(new Request('https://site.test/sitemap.xml'),{})).text();for(const path of publicSitePaths)assert(sitemap.includes('https://playtouchline.dk'+path));assert(!sitemap.includes('/play<'));assert(!sitemap.includes('/owner-builds/'));
});
test('favicon uses the original shared Touchline vector and constrains markup options',async()=>{
 const response=await worker.fetch(new Request('https://site.test/favicon.svg'),{});assert.equal(await response.text(),touchlineMarkSvg());
 assert(touchlineMarkSvg().includes(BRAND_MARK.t));assert(!touchlineMarkSvg({background:'"><script>',size:NaN}).includes('<script>'));
});
