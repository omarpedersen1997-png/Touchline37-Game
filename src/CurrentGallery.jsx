import React from'react';
import{ArrowUpRight}from'lucide-react';
import{is4KSiteCapture}from'../shared/site-capture-policy.js';

const compiledCaptures=typeof __SITE_CAPTURES__!=='undefined'?__SITE_CAPTURES__:[];
// The build injects only files verified against the current signed APK.
export default function CurrentGallery({captures=compiledCaptures}={}){
 const current=Array.isArray(captures)?captures.filter(item=>item&&is4KSiteCapture(item.width,item.height)&&typeof item.src==='string'&&item.src.startsWith('/assets/captures/')):[];
 if(!current.length)return null;
 return <section id="billeder" className="site-section site-current-gallery" aria-labelledby="site-current-gallery-title"><div className="section-heading"><span className="eyebrow">APPENS AKTUELLE WEBVISNING</span><h2 id="site-current-gallery-title">Spillet.<br/><em>Helt tæt på.</em></h2><p>Originale skærmbilleder fra appens aktuelle webvisning, optaget direkte i 4K. Web og Android bruger den samme brugerflade og kampmotor. Åbn et billede for at se det i fuld opløsning.</p></div><div className="site-current-gallery-grid">{current.map(item=><figure key={item.id}><a href={item.src} target="_blank" rel="noopener noreferrer" aria-label={'Åbn '+item.title+' i fuld opløsning (ny fane)'}><div className="site-current-gallery-frame"><img src={item.src} alt={item.alt} width={item.width} height={item.height} loading="lazy" decoding="async"/></div><span className="site-current-gallery-resolution">{item.width.toLocaleString('da-DK')} × {item.height.toLocaleString('da-DK')}<ArrowUpRight size={17}/></span></a><figcaption><h3>{item.title}</h3><p>{item.description}</p></figcaption></figure>)}</div></section>;
}
