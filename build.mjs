import{loadVerifiedSiteCaptures}from'./scripts/verify-site-captures.mjs';
import{siteHead}from'./shared/site-metadata.js';
import{createHash}from'node:crypto';
import{build,transform}from'esbuild';import{mkdir,readFile,writeFile,cp}from'node:fs/promises';
await mkdir('dist/server',{recursive:true});
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));
const captures=await loadVerifiedSiteCaptures();
const proPlayerAutoUrl='data:model/gltf-binary;base64,'+(await readFile('assets/game/football-auto.glb')).toString('base64');
const proPlayerUrl='data:model/gltf-binary;base64,'+(await readFile('assets/game/football-pro.glb')).toString('base64');
const launch=JSON.parse(await readFile('release/launch.json','utf8'));
const download=JSON.parse(await readFile('release/downloads/current.json','utf8'));
if(!Number.isFinite(Date.parse(launch.opensAt))||new Date(launch.opensAt).toISOString()!==launch.opensAt||launch.timeZone!=='Europe/Copenhagen'||!/^\d+\.\d+\.\d+$/.test(launch.apkVersion)||launch.apkVersion!==download.version)throw Error('Launch schedule and APK metadata must be valid and agree.');
if(![`Touchline-${launch.apkVersion}-test.apk`,`Touchline-${launch.apkVersion}.apk`].includes(download.apk))throw Error('Unexpected local APK artifact name.');
const apkBytes=await readFile('release/downloads/'+download.apk);
if(!/^[a-f0-9]{64}$/.test(download.sha256||'')||createHash('sha256').update(apkBytes).digest('hex')!==download.sha256)throw Error('APK does not match the approved release hash.');
const fonts=(await Promise.all([['DM Sans','DM-Sans.ttf','100 1000'],['Barlow Condensed','Barlow-Condensed.ttf','500 800']].map(async([family,file,weight])=>`@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${(await readFile('assets/fonts/'+file)).toString('base64')}) format('truetype');font-weight:${weight};font-display:swap;}`))).join('');
const portraitCss=':root{--player-portrait-sheet:url(data:image/webp;base64,'+(await readFile('assets/game/portraits.webp')).toString('base64')+');}';
async function page(entry,stylesheet,webGame=false){const c=await build({entryPoints:[entry],bundle:true,minify:true,write:false,loader:{'.css':'text','.webp':'dataurl'},define:{'__TOUCHLINE_PUBLIC_SITE__':JSON.stringify(entry==='src/WebSupport.jsx'),'process.env.NODE_ENV':'"production"','__WEB_GAME__':JSON.stringify(webGame),'__SITE_CAPTURES__':JSON.stringify(captures.screenshots),'__PRO_PLAYER_URL__':JSON.stringify(proPlayerUrl),'__PRO_PLAYER_AUTO_URL__':JSON.stringify(proPlayerAutoUrl)},outdir:'tmp'});const js=c.outputFiles.find(f=>f.path.endsWith('.js')).text;const extra=stylesheet==='src/style.css'?(await Promise.all(['src/expansion.css','src/clubstudio.css','src/web-release.css','src/player-career.css','src/refresh.css','src/career-journey.css','src/manual-match.css','src/match-modes.css','src/redesign.css','src/redesign-club.css','src/redesign-career.css','src/redesign-auth.css','src/forest.css','src/game-dashboard.css','src/game-match.css','src/game-sections.css','src/match-statistics.css','src/match-upgrade.css','src/landscape-app.css','src/workspace-deck.css','src/stadium-console.css','src/touchline-tokens.css','src/startup-splash.css'].map(file=>readFile(file,'utf8')))).join('\n'):(await Promise.all(['src/redesign-site.css','src/redesign-auth.css','src/forest.css','src/forest-site.css','src/game-presentation.css','src/site-update.css','src/current-gallery.css'].map(file=>readFile(file,'utf8')))).join('\n');const rawCss=((await readFile(stylesheet,'utf8'))+'\n'+extra).replace(/@import\s+url\([^)]*\)\s*;/g,'');const css=(await transform(rawCss,{loader:'css',minify:true})).code;return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#0b141d">${stylesheet==='src/style.css'?'<title>Touchline — Football Idle</title>':'<!--site-head-->'+siteHead('/')+'<!--/site-head-->'}<link rel="icon" href="/favicon.svg"><style>${fonts+css+(stylesheet==='src/style.css'?portraitCss:'')}</style></head><body><div id="root"></div><noscript>Slå JavaScript til for at vise Touchline. Kontakt og privatliv findes på /contact og /privacy.</noscript><script type="module">${js.replaceAll('</script','<\\/script')}</script></body></html>`}
await mkdir('native-web',{recursive:true});await mkdir('native-web/third-party',{recursive:true});await cp('assets/game/FOOTBALL-ASSET-LICENSES.md','native-web/third-party/football-assets.txt');await writeFile('native-web/index.html',await page('src/App.jsx','src/style.css'));
const launchGame=await page('src/App.jsx','src/style.css',true);
await writeFile('generated-launch-game.js',`export default ${JSON.stringify(launchGame)};`);
await writeFile('generated-launch-apk.js',`export default ${JSON.stringify(hosting.r2?'':apkBytes.toString('base64'))};`);
await writeFile('generated-page.js',`export default ${JSON.stringify(await page('src/WebSupport.jsx','src/site.css'))};`);
const illustrations=Object.fromEntries(await Promise.all(['arena-2','kit-2','badge-2'].map(async name=>[name,(await readFile('assets/site/'+name+'.svg')).toString('base64')])));
await writeFile('generated-site-art.js',`export default ${JSON.stringify({...illustrations,share:(await readFile('assets/site/touchline-share.png')).toString('base64')})};`);
await writeFile('generated-site-captures.js',`export default ${JSON.stringify(Object.fromEntries(Object.entries(captures.assets).map(([path,item])=>[path,{base64:item.bytes.toString('base64'),contentType:item.contentType,sha256:item.sha256,bytes:item.bytes.length}])))};`);
await build({entryPoints:['worker/index.js'],bundle:true,minify:true,format:'esm',platform:'browser',outfile:'dist/server/index.js'});
await mkdir('dist/.openai',{recursive:true});await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/drizzle',{recursive:true});console.log('Built separate Android assets, marketing and server-gated scheduled release.');

if(process.argv.includes('--web-draft')){
 const html=launchGame;
 await mkdir('web-draft',{recursive:true});
 await writeFile('web-draft/game.html',html);
 await writeFile('generated-web-game.js',`export default ${JSON.stringify(html)};`);
 await build({entryPoints:['worker/web-draft.js'],bundle:true,minify:true,format:'esm',platform:'browser',outfile:'web-draft/server.mjs'});
 console.log('Built LOCAL always-open web draft at /play; production remains protected by the configured launch time. No deployment performed.');
}
