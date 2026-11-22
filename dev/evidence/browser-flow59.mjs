import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGame,publicState} from '../../worker/game.js';
import {getArcadeRules} from '../../shared/arcade.js';
const root=process.cwd(),out=root+'/.dev-data/review/browser59-flow';await mkdir(out,{recursive:true});
const html=await readFile(root+'/.dev-data/android-web/public/index.html','utf8'),seed=createGame(Date.now());Object.assign(seed,{name:'Prøvelund BK',named:true,money:250000,clubStyle:{color:'lime',pattern:'stripe',crest:'shield'}});let state=publicState(seed,Date.now()),postEvidence=null;
const errors=[],blocked=[],checks=[],versions={latest:11,supported:[1,2,3,4,5,6,7,8,9,10,11]};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking','--no-first-run'],env:{...process.env,TMPDIR:'/dev/shm'}});
const context=await browser.newContext({locale:'da-DK',timezoneId:'Europe/Copenhagen',viewport:{width:915,height:412},deviceScaleFactor:1});let page;
await context.route('**/*',async route=>{
 const u=new URL(route.request().url());if(u.hostname!=='touchline-layout.invalid'){blocked.push(u.hostname);return route.abort();}
 if(u.pathname==='/api/auth/me')return route.fulfill({json:{user:{id:'flow-fixture',email:'flow@touchline.invalid'}}});
 if(u.pathname==='/api/game'){
  if(route.request().method()==='POST'){
   const data=route.request().postDataJSON();assert.equal(data.manualVersion,11);postEvidence=await page.evaluate(()=>{const host=document.querySelector('[data-touchline-prewarm="ready"]');window.preparedCanvas=host?.querySelector('canvas');return{ready:!!host,canvas:!!window.preparedCanvas,at:performance.now()};});assert(postEvidence.ready&&postEvidence.canvas,'GPU must be ready BEFORE the server starts the clock');
   const started=Date.now()+3500,rules=getArcadeRules(11,3);state={...state,active:{id:'flow59',opponent:'Havneby IF',started,ends:started+rules.DURATION_MS,control:'manual',manual:{version:11,seed:'flow59',duration:rules.DURATION_MS,inputCount:rules.INPUT_COUNT,expiresAt:started+rules.DURATION_MS+86400000,config:{matchVersion:11,engineRevision:3,homeRating:65,awayRating:60,formation:'4-3-3',tactic:'balanced'}}}};
  }return route.fulfill({json:{state:{...state,serverTime:Date.now()},matchVersions:versions}});
 }
 if(u.pathname.startsWith('/api/'))return route.fulfill({status:403,json:{error:'Isoleret fixture; ingen serverændringer.'}});
 if(u.pathname.startsWith('/assets/')||u.pathname.startsWith('/match-assets55/')||u.pathname==='/favicon.svg')return route.fulfill({body:await readFile((u.pathname==='/favicon.svg'?root:root+'/.dev-data/android-web/public')+u.pathname),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.svg')?'image/svg+xml':'application/octet-stream'});
 return route.fulfill({contentType:'text/html',body:html});
});
try{
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('https://touchline-layout.invalid');await page.locator('.startup-splash').waitFor({state:'detached'});await page.locator('.game-lobby').waitFor();
 await page.getByRole('button',{name:/Spil selv i 3D/}).first().click();await page.getByRole('button',{name:'Gå til afspark',exact:true}).waitFor();
 await page.evaluate(()=>{window.hudReveals=[];new MutationObserver(()=>{const m=document.querySelector('.game-match');if(m&&!document.querySelector('.manual-loading')&&window.hudReveals.length===0)window.hudReveals.push({phase:m.dataset.matchPhase,score:document.querySelector('.manual-score')?.textContent});}).observe(document.body,{subtree:true,childList:true,attributes:true});});
 await page.getByRole('button',{name:'Gå til afspark',exact:true}).click({timeout:120000});await page.waitForFunction(()=>document.querySelector('.game-match')?.dataset.matchPhase==='KICK_OFF'&&!document.querySelector('.manual-loading'),{timeout:120000});
 const handoff=await page.evaluate(()=>({sameCanvas:window.preparedCanvas===document.querySelector('.manual-field canvas'),orphanHosts:document.querySelectorAll('[data-touchline-prewarm]').length,reveals:window.hudReveals,phase:document.querySelector('.game-match').dataset.matchPhase,score:document.querySelector('.manual-score').textContent}));assert(handoff.sameCanvas);assert.equal(handoff.orphanHosts,0);assert.equal(handoff.reveals[0].phase,'KICK_OFF');await page.screenshot({path:out+'/kickoff-915x412.png'});
 await page.waitForFunction(()=>document.querySelector('.game-match')?.dataset.matchPhase==='PLAYING',{timeout:30000});
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');await page.getByRole('button',{name:'Kampindstillinger',exact:true}).click();
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Hent kampbackup',exact:true}).click();const download=await waiting,backup=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(backup.kind,'touchline-match-recording');
 await page.getByRole('button',{name:'Tilbage på banen',exact:true}).click();await page.screenshot({path:out+'/playing-915x412.png'});await page.getByRole('button',{name:'Luk kampvisning',exact:true}).click();await page.locator('.game-lobby').waitFor();assert(await page.evaluate(()=>!document.fullscreenElement));
 state={...state,active:null};
 for(const [width,height]of [[320,640],[360,740],[384,724],[390,844],[740,360],[1280,800]]){
  await page.setViewportSize({width,height});await page.goto('https://touchline-layout.invalid');await page.locator('.startup-splash').waitFor({state:'detached'});await page.locator('.game-lobby').waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width);assert.equal(await page.locator('.lobby-quick-actions button').count(),6);assert((await page.locator('.game-balance').textContent()).includes('kr.'));await page.screenshot({path:out+`/menu-${width}.png`,fullPage:height>width});checks.push({width,height,noHorizontalOverflow:true,sixShortcuts:true,currency:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);await writeFile(out+'/checks.json',JSON.stringify({fixtureOnly:true,postEvidence,handoff,backupKind:backup.kind,checks,errors,blocked},null,2));console.log(JSON.stringify({postEvidence,handoff,checks,errors,blocked}));
}catch(error){console.log(JSON.stringify({error:String(error),errors,blocked,text:await page.locator('body').innerText()}));await page.screenshot({path:out+'/failure.png'});throw error;}finally{await browser.close();}
