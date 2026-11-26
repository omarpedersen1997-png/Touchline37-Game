import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const base=dirname(fileURLToPath(import.meta.url));
const output=resolve(process.argv[2]||base+'/dist');
const android=process.argv.includes('--android');
const siteName='Touchline · Motor 12';
const published='https://playtouchline.dk';
const styles='assets/ui.css';
const header=(base,match=false)=>`<header class="top"><div class="wrap nav"><a class="mark" href="${base}index.html" aria-label="Touchline forside"><i aria-hidden="true">T</i> Touchline<span>.</span></a>${match?'<span class="nav-meta">MOTOR 12 · KLUBHUSET</span>':`<nav aria-label="Hovedmenu"><a href="${base}index.html#motor">Motoren</a><a href="${base}index.html#klub">Klubben</a><a href="${base}contact/index.html">Support</a></nav><a class="button primary nav-play" href="${base}play/index.html?demo=1">Prøvekamp</a>`}</div></header>`;
const footer=base=>`<footer class="foot"><div class="wrap foot-inner"><span>TOUCHLINE <small>© 2026 OPNext Games</small></span><nav aria-label="Hjælp og vilkår">${android?'<a href="/legacy.html">Motor 11</a>':''}<a href="${base}contact/index.html">Kontakt</a><a href="${base}privacy/index.html">Privatliv</a><a href="${base}delete-account/index.html">Slet konto</a></nav></div></footer>`;
const shell=({title,body,base='./',match=false,script='',description='Touchline er et dansk fodboldmanagerspil. Prøv en lokal Motor 12-kamp, og byg din klub på Android og web.'})=>`<!doctype html><html lang="da"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c1313"><meta name="description" content="${description}">
<meta name="robots" content="noindex">
<meta property="og:title" content="${title}"><meta property="og:description" content="${description}">
<meta property="og:type" content="website"><title>${title}</title>
<link rel="icon" href="${base}assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${base}${styles}">${script?`<script type="module" src="${base}src/${script}"></script>`:''}</head>
<body><a class="skip" href="#main">Gå til indhold</a>${header(base,match)}${body}${footer(base)}</body></html>`;

const landing=`<main id="main">
<section class="hero"><div class="hero-image"></div><div class="wrap hero-inner"><div class="hero-copy">
  <p class="kicker"><span></span> FODBOLDMANAGER · MOTOR 12</p>
  <h1>Byg holdet.<br>Læs <em>kampen.</em></h1>
  <p>Sæt startelleveren, vælg preshøjde og se din kampplan udfolde sig. På sidelinjen bestemmer du, hvornår kampen fløjtes i gang.</p>
  <div class="hero-actions"><a class="button primary" href="./play/index.html?demo=1">Start prøvekamp</a><a class="button quiet" href="./play/index.html">Gå til klubhuset</a></div>
</div><div class="hero-score"><div class="score-cap">MOTOR 12 <strong>KLAR TIL AFSPARK</strong></div><div class="score-big"><b>PBK</b><span>0 : 0</span><b>HIF</b></div><div class="score-cap">PRØVELUND BK <strong>00:00</strong> HAVNEBY IF</div></div></div></section>
<section class="release"><div class="wrap release-inner"><div><p class="kicker">LANCERING · ANDROID &amp; WEB</p><h2>01.01.2027 <small>Fredag kl. 10.00 · København</small></h2></div><div id="countdown" class="countdown" aria-label="Tid til lancering"><div><b>–</b><span>Dage</span></div><div><b>–</b><span>Timer</span></div><div><b>–</b><span>Min.</span></div><div><b>–</b><span>Sek.</span></div></div></div></section>
<section id="motor" class="wrap editorial">
 <p class="kicker">PÅ BANEN</p><h2>Fra afspark<br>til slutfløjt.</h2>
 <div class="feature-grid"><article class="feature"><span class="tag">SIMULATION</span><h3>Følg bold og kæder</h3><p>Bolden ruller, skruer og hopper i samme koordinatsystem som alle 22 spillere. Se løb uden bold, målmandsredninger og kampen om andenbolden.</p></article>
 <article class="feature"><span class="tag">TAKTIK</span><h3>Flyt presset</h3><p>Skift formation, mentalitet og pres under kampen. Følg afslutninger, xG, afleveringer og momentum, mens spillet finder en ny rytme.</p></article>
 <article class="feature"><span class="tag">KAMPDAG</span><h3>Du giver signalet</h3><p>Bolden ligger på midterpletten, indtil du vælger <strong>Kick Off</strong>. Det gælder kampstart, anden halvleg og genstart efter mål.</p></article></div>
</section>
<section id="klub" class="club-band"><div class="wrap club-band-inner"><div><p class="kicker">KLUBHUSET</p><h2>Truppen er dit<br>vigtigste valg.</h2></div><div><p>Vælg startellever og reserver efter form og kondition. Håndtér træning og kampindtægter, og brug rapporten til at planlægge den næste kamp.</p><a class="button primary" href="./play/index.html">Åbn klubhuset</a></div></div></section>
</main>`;
const app=`<main id="main" class="wrap app-main"><div id="game"><p>Åbner klubhuset…</p></div><noscript>Motor 12 kræver JavaScript for at kunne afvikle en kamp.</noscript></main>`;
const support=(title,blocks)=>`<main id="main" class="wrap support"><div class="kicker">OPNEXT GAMES · TOUCHLINE</div><h1>${title}</h1><div class="legal-body">${blocks}</div></main>`;
const supportBody=support('Kontakt og support',`<p>Har du brug for hjælp til spillet, din konto eller dine oplysninger? Brug den officielle kontaktformular til at sende din henvendelse.</p><p>Send aldrig din adgangskode eller engangskoder.</p><a class="button primary" href="${published}/contact">Åbn kontaktformularen</a><p><a href="../delete-account/index.html">Læs om kontosletning</a></p>`);
const privacy=support('Privatliv',`<h2>Motor 12-udgaven</h2><p>Klubhus, lydindstilling og aktiv kamp gemmes lokalt i browseren eller appen. Prøvekamp bruger kun den aktuelle fane. Denne udgave har ingen konto eller serversynkronisering.</p><h2>Dit eksisterende Touchline-login</h2><p>Læs den officielle privatlivspolitik om konto, klub, hosting og dine rettigheder.</p><a class="button primary" href="${published}/privacy">Officiel privatlivspolitik</a><p><a href="../delete-account/index.html">Sletning af data</a></p>`);
const deletion=support('Slet konto eller klub',`<h2>Eksisterende Touchline-konto</h2><p>Åbn den officielle formular med kontosletning forvalgt. Touchline bekræfter ejerskab før sletning.</p><a class="button primary" href="${published}/contact?topic=deletion">Anmod om kontosletning</a><h2>Lokal Motor 12-klub</h2><p>I Motor 12 kan du slette dine lokale data fra Klubstatus. Det fjerner din klub og aktive kamp på denne enhed.</p><a class="button quiet" href="../play/index.html#club">Gå til Klubstatus</a>`);
const pages=[['index.html',shell({title:siteName+' · Byg holdet. Læs kampen.',body:landing,script:'landing.js'})],
  ['play/index.html',shell({title:siteName+' · Klubhus',body:app,base:'../',script:'app.js',match:true})],
  ['contact/index.html',shell({title:siteName+' · Kontakt',body:supportBody,base:'../'})],
  ['privacy/index.html',shell({title:siteName+' · Privatliv',body:privacy,base:'../'})],
  ['delete-account/index.html',shell({title:siteName+' · Slet konto',body:deletion,base:'../'})]];
await mkdir(output,{recursive:true});
await cp(resolve(base,'src'),resolve(output,'src'),{recursive:true});
await cp(resolve(base,'assets'),resolve(output,'assets'),{recursive:true});
for(const[path,html] of pages){
  await mkdir(dirname(resolve(output,path)),{recursive:true});
  await writeFile(resolve(output,path),html);
}
await readFile(resolve(output,'assets/hero.webp'));
console.log('Touchline Motor 12:',output,'·',pages.length,'sider');
