const origin='https://playtouchline.dk';
const pages={
 '/':{title:'Touchline — Din klub. Din fodboldhistorie.',description:'Byg din klub, skab din spillerkarriere, og spil selv i 3D eller simulér kampene. Touchline åbner til Android og web den 1. januar 2027 kl. 10.'},
 '/contact':{title:'Kontakt og support — Touchline',description:'Kontakt OPNext Games om Touchline, din konto eller feedback til spillet.'},
 '/privacy':{title:'Privatliv — Touchline',description:'Læs om kontooplysninger, spilfremskridt, lagring og dine rettigheder i Touchline fra OPNext Games.'},
 '/delete-account':{title:'Slet din konto — Touchline',description:'Sådan sletter du din Touchline-konto og dine klubdata eller kontakter support om sletning.'}
};
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function siteHead(path='/'){
 const route=Object.hasOwn(pages,path)?path:'/',meta=pages[route],url=origin+(route==='/'?'/':route),image=origin+'/assets/touchline-share.png';
 return `<title>${escape(meta.title)}</title><meta name="description" content="${escape(meta.description)}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:locale" content="da_DK"><meta property="og:site_name" content="Touchline"><meta property="og:title" content="${escape(meta.title)}"><meta property="og:description" content="${escape(meta.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="3840"><meta property="og:image:height" content="2160"><meta property="og:image:alt" content="Touchline. Små begyndelser. Store spiloplevelser."><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(meta.title)}"><meta name="twitter:description" content="${escape(meta.description)}"><meta name="twitter:image" content="${image}">`;
}
export function applySiteHead(html,path){return html.replace(/<!--site-head-->[\s\S]*?<!--\/site-head-->/,`<!--site-head-->${siteHead(path)}<!--/site-head-->`);}
export const publicSitePaths=Object.freeze(Object.keys(pages));
