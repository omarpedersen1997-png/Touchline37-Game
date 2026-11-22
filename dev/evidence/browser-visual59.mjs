import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=process.cwd(),out=root+'/.dev-data/review/browser59-visual';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking'],env:{...process.env,TMPDIR:'/dev/shm'}}),results=[];
try{for(const profile of ['before','after']){
 const errors=[],blocked=[],context=await browser.newContext({viewport:{width:915,height:412},deviceScaleFactor:1});
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='visual.invalid'){blocked.push(u.hostname);return route.abort();}
  if(u.pathname.startsWith('/match-assets55/'))return route.fulfill({body:await readFile(root+'/public'+u.pathname),contentType:'application/octet-stream'});
  if(u.pathname.startsWith('/assets/models/'))return route.fulfill({body:await readFile(root+'/assets/game/'+u.pathname.split('/').at(-1)),contentType:'application/octet-stream'});
  if(u.pathname==='/scene.js')return route.fulfill({body:await readFile(root+'/.dev-data/review/visual59-'+profile+'/visual59-entry.js'),contentType:'text/javascript'});
  return route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="field" style="width:100vw;height:100vh"></div><script type="module" src="/scene.js"></script></body></html>'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('https://visual.invalid');await page.waitForFunction(()=>window.visualReady,{timeout:120000});
 const landscape=await page.evaluate(()=>window.visualResult);assert.equal(landscape.mode,'3d');await page.screenshot({path:out+'/'+profile+'-915x412.png'});
 await page.setViewportSize({width:390,height:844});const portrait=await page.evaluate(()=>window.drawVisual());await page.screenshot({path:out+'/'+profile+'-390x844.png'});
 await page.setViewportSize({width:915,height:412});const goal=await page.evaluate(()=>window.drawGoalVisual());await page.screenshot({path:out+'/'+profile+'-goal-915x412.png'});
 const figures=await page.evaluate(()=>window.drawFigures());await page.screenshot({path:out+'/'+profile+'-figures-pass.png'});assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);results.push({profile,landscape,portrait,goal,figures,errors,blocked});await context.close();
}assert.equal(results[0].landscape.tick,results[1].landscape.tick);assert.deepEqual(results[0].landscape.ball,results[1].landscape.ball);assert.deepEqual(results[0].goal.ball,results[1].goal.ball);
 await writeFile(out+'/checks.json',JSON.stringify({source:'Samme deterministiske R3-state og fast skærmopløsning. Isoleret Chromium, ikke telefon-FPS.',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
