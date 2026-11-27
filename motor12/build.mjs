import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { build } from 'esbuild';

const base=dirname(fileURLToPath(import.meta.url));
const output=resolve(process.argv[2]||base+'/dist');
const android=process.argv.includes('--android');
const draftOption=process.argv.indexOf('--website-dir');
const draftDir=draftOption<0?null:process.argv[draftOption+1];
if(draftOption>=0&&(!android||!draftDir))throw Error('--website-dir kræver --android og en bygget hjemmesidemappe');
const siteName='Touchline · Motor 12';
const published='https://playtouchline.dk';
const shell=({title,body,base='./',match=false,script=''})=>`<!doctype html><html lang="da"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#071610"><meta name="robots" content="noindex"><title>${title}</title>
<link rel="icon" href="${base}assets/icon.svg"><link rel="stylesheet" href="${base}assets/stadium.css"><link rel="stylesheet" href="${base}assets/cockpit.css">
${script?`<script type="module" src="${base}src/${script}"></script>`:''}</head>
<body class="${match?'cockpit':'help-page'}">${match&&android?'<script type="module" src="../assets/landscape.js"></script>':''}
<header class="cockpit-mast"><a class="brand" href="${base}index.html" aria-label="Touchline · stadion"><i aria-hidden="true">T</i> TOUCHLINE</a><span class="mast-title">${match?'Kampcentral':'Support'}</span><a class="back-site" href="${base}index.html#klub">Stadion ↗</a></header>
${body}${match?'':`<footer><a href="${base}contact/index.html">Kontakt</a><a href="${base}privacy/index.html">Privatliv</a><a href="${base}delete-account/index.html">Slet konto</a></footer>`}</body></html>`;
const landing=await readFile(resolve(base,'showcase.html'),'utf8');
const app=`<main id="main"><div id="game"></div><noscript>Motor 12 kræver JavaScript.</noscript></main>${android?`<template id="legacy-entry">${draftDir?'<a href="/motor12/kampdag/index.html">Hjemmesideudkast</a> · ':''}<a href="/legacy.html">Motor 11</a></template>`:''}`;
const support=(title,blocks)=>`<main id="main" class="wrap support"><div class="kicker">OPNEXT GAMES · TOUCHLINE</div><h1>${title}</h1><div class="legal-body">${blocks}</div></main>`;
const supportBody=support('Kontakt og support',`<p>Har du brug for hjælp til spillet, din konto eller dine oplysninger? Brug den officielle kontaktformular til at sende din henvendelse.</p><p>Send aldrig din adgangskode eller engangskoder.</p><a class="button primary" href="${published}/contact">Åbn kontaktformularen</a><p><a href="../delete-account/index.html">Læs om kontosletning</a></p>`);
const privacy=support('Privatliv',`<h2>Motor 12-udgaven</h2><p>Klubhus, lydindstilling og aktiv kamp gemmes lokalt i browseren eller appen. Prøvekamp bruger kun den aktuelle fane. Denne udgave har ingen konto eller serversynkronisering.</p><h2>Dit eksisterende Touchline-login</h2><p>Læs den officielle privatlivspolitik om konto, klub, hosting og dine rettigheder.</p><a class="button primary" href="${published}/privacy">Officiel privatlivspolitik</a><p><a href="../delete-account/index.html">Sletning af data</a></p>`);
const deletion=support('Slet konto eller klub',`<h2>Eksisterende Touchline-konto</h2><p>Åbn den officielle formular med kontosletning forvalgt. Touchline bekræfter ejerskab før sletning.</p><a class="button primary" href="${published}/contact?topic=deletion">Anmod om kontosletning</a><h2>Lokal Motor 12-klub</h2><p>I Motor 12 kan du slette dine lokale data fra Klubstatus. Det fjerner din klub og aktive kamp på denne enhed.</p><a class="button quiet" href="../play/index.html#club">Gå til Klubstatus</a>`);
const pages=[['index.html',landing],
  ['play/index.html',shell({title:siteName+' · Klubhus',body:app,base:'../',script:'app.js',match:true})],
  ['contact/index.html',shell({title:siteName+' · Kontakt',body:supportBody,base:'../'})],
  ['privacy/index.html',shell({title:siteName+' · Privatliv',body:privacy,base:'../'})],
  ['delete-account/index.html',shell({title:siteName+' · Slet konto',body:deletion,base:'../'})]];
await mkdir(output,{recursive:true});
await cp(resolve(base,'src'),resolve(output,'src'),{recursive:true,filter:path=>!path.endsWith('/landing.js')});
await cp(resolve(base,'assets'),resolve(output,'assets'),{recursive:true,filter:path=>!['/hero.webp','/ui.css','/club-cover.webp'].some(suffix=>path.endsWith(suffix))});
if(android){
  await build({stdin:{contents:`import {enterMatchDisplay,exitMatchDisplay} from './src/match-display.js';
    window.addEventListener('pageshow',()=>enterMatchDisplay().catch(()=>{}));
    window.addEventListener('pagehide',()=>exitMatchDisplay().catch(()=>{}));
    enterMatchDisplay().catch(()=>{});`,resolveDir:resolve(base,'..')},
    bundle:true,format:'esm',minify:true,target:'chrome100',outfile:resolve(output,'assets/landscape.js')});
}
const stadiumAssets=resolve(output,'assets/arena');
await mkdir(stadiumAssets,{recursive:true});
for(const file of ['player-auto.glb','keeper-auto.glb','FOOTBALL-ASSET-LICENSES.md']){
  await cp(resolve(base,'../public/match-assets55',file),resolve(stadiumAssets,file));
}
await build({entryPoints:[resolve(base,'src/arena.js')],outfile:resolve(output,'assets/arena.js'),
  bundle:true,format:'esm',minify:true,target:'chrome100',legalComments:'linked'});
for(const[path,html] of pages){
  await mkdir(dirname(resolve(output,path)),{recursive:true});
  await writeFile(resolve(output,path),html);
}
if(draftDir&&(await readFile(resolve(draftDir,'index.html'),'utf8')).includes('id="scenes"')){
  await cp(resolve(draftDir),resolve(output,'kampdag'),{recursive:true,filter:path=>!path.endsWith('/.openai')});
}else if(draftDir){
  // The website is rooted at / on a web host. In Capacitor / belongs to the
  // existing app, so mount it under kampdag and reuse the installed match.
  const dest=resolve(output,'kampdag');
  const siteRoot='/motor12/kampdag/';
  function mountedPath(path){
    if(path.startsWith('/demo/play/'))return '/motor12/'+path.slice('/demo/'.length);
    if(path==='/'||path.startsWith('/#'))return siteRoot+'index.html'+path.slice(1);
    if(['/contact','/privacy','/delete-account'].includes(path))return siteRoot+path.slice(1)+'/index.html';
    return siteRoot+path.slice(1);
  }
  for(const file of ['index.html','contact/index.html','privacy/index.html','delete-account/index.html','site.js','site.css']){
    let text=await readFile(resolve(draftDir,file),'utf8');
    text=text.replace(/(href|src)="(\/(?!\/)[^"]*)"/g,(_,attr,path)=>attr+'="'+mountedPath(path)+'"')
      .replace(/url\((\/[^)]+)\)/g,(_,path)=>'url('+mountedPath(path)+')')
      .replace(/'(\/(?:demo\/play|assets\/motor12)\/[^']*)'/g,(_,path)=>"'"+mountedPath(path)+"'");
    await mkdir(dirname(resolve(dest,file)),{recursive:true});
    await writeFile(resolve(dest,file),text);
  }
  await cp(resolve(draftDir,'assets'),resolve(dest,'assets'),{recursive:true});
  await cp(resolve(draftDir,'favicon.svg'),resolve(dest,'favicon.svg'));
}
await readFile(resolve(output,'assets/stadium-night.webp'));
console.log('Touchline Motor 12:',output,'·',pages.length,'sider');
