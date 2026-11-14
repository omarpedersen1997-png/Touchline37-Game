import React,{useEffect,useId,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{ArrowLeft,ArrowRight,Expand,X}from'lucide-react';
import{SCREENSHOTS}from'./site-gallery-data.js';

function captureStyle(item){return{marginTop:`-${item.clipTop/item.width*100}%`,marginBottom:`-${item.clipBottom/item.width*100}%`}}

export function GalleryDialogContent({item,index,total,onClose,onStep,dialogRef,closeRef,scrollRef,titleId='gallery-dialog-title'}){
 return <section className="app-gallery-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={titleId+'-help'}><header className="app-gallery-dialog-header"><div><span className="app-gallery-dialog-count" aria-live="polite">Billede {index+1} af {total}</span><h2 id={titleId}>{item.title}</h2><p className="app-gallery-dialog-description">{item.description}<span className="app-gallery-version-note">Fra en tidligere udviklingsversion.</span></p></div><button className="app-gallery-close" type="button" ref={closeRef} onClick={onClose} aria-label="Luk billedvisning"><X size={20}/><span>Luk</span></button></header><div className="app-gallery-dialog-scroll" ref={scrollRef} role="region" aria-label="Hele skærmbilledet, rul for at se mere" tabIndex={0}><div className="app-gallery-full-capture" style={{maxWidth:'420px'}}><img src={item.src} alt={item.alt} width={item.width} height={item.height} style={captureStyle(item)}/></div></div><footer className="app-gallery-dialog-footer"><p id={titleId+'-help'}>Rul for at se hele billedet. Brug piletasterne til at skifte og Esc til at lukke.</p><div className="app-gallery-dialog-actions"><button type="button" onClick={()=>onStep(-1)} disabled={total<2} aria-label="Forrige billede"><ArrowLeft size={19}/><span>Forrige</span></button><button type="button" onClick={()=>onStep(1)} disabled={total<2} aria-label="Næste billede"><span>Næste</span><ArrowRight size={19}/></button></div></footer></section>
}

export default function SiteGallery(){
 const[index,setIndex]=useState(null),overlayRef=useRef(null),dialogRef=useRef(null),closeRef=useRef(null),scrollRef=useRef(null),returnFocus=useRef(null);const id=useId().replaceAll(':','');const open=index!==null;
 const step=direction=>setIndex(current=>current===null?null:(current+direction+SCREENSHOTS.length)%SCREENSHOTS.length);
 const dismiss=()=>setIndex(null);
 useEffect(()=>{
  if(!open)return;
  const previousFocus=returnFocus.current||document.activeElement,body=document.body;
  const oldOverflow=body.style.overflow,oldPadding=body.style.paddingRight;
  const scrollbar=Math.max(0,window.innerWidth-document.documentElement.clientWidth);
  const background=[...body.children].filter(node=>node!==overlayRef.current).map(node=>({node,inert:node.getAttribute('inert'),hidden:node.getAttribute('aria-hidden')}));
  closeRef.current?.focus();
  for(const{node}of background){node.setAttribute('inert','');node.setAttribute('aria-hidden','true')}
  body.style.overflow='hidden';if(scrollbar)body.style.paddingRight=`${parseFloat(getComputedStyle(body).paddingRight||'0')+scrollbar}px`;
  const keyboard=event=>{
   if(event.key==='Escape'){event.preventDefault();setIndex(null);return}
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const direction=event.key==='ArrowRight'?1:-1;setIndex(current=>current===null?null:(current+direction+SCREENSHOTS.length)%SCREENSHOTS.length);return}
   if(event.key!=='Tab'||!dialogRef.current)return;
   const controls=[...dialogRef.current.querySelectorAll('button:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length);
   const first=controls[0],last=controls.at(-1);if(!first){event.preventDefault();return}
   if(event.shiftKey&&(document.activeElement===first||!dialogRef.current.contains(document.activeElement))){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&(document.activeElement===last||!dialogRef.current.contains(document.activeElement))){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',keyboard);
  return()=>{
   document.removeEventListener('keydown',keyboard);body.style.overflow=oldOverflow;body.style.paddingRight=oldPadding;
   for(const{node,inert,hidden}of background){if(inert===null)node.removeAttribute('inert');else node.setAttribute('inert',inert);if(hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',hidden)}
   if(previousFocus?.isConnected)previousFocus.focus();
  };
 },[open]);
 useEffect(()=>{if(scrollRef.current){scrollRef.current.scrollTop=0;scrollRef.current.scrollLeft=0}},[index]);
 const current=open?SCREENSHOTS[index]:null;
 return <section id="billeder" className="site-section app-gallery" aria-labelledby={id+'-title'}><div className="section-heading"><span className="eyebrow">FRA DEN RIGTIGE APP</span><h2 id={id+'-title'}>Se spillet<br/><em>indefra.</em></h2><p>Skærmbilleder fra en tidligere udviklingsversion af Android-appen. Tryk på et billede, og rul gennem hele visningen.</p></div><div className="app-gallery-grid">{SCREENSHOTS.map((item,i)=><figure className="app-gallery-card" key={item.id}><button type="button" className="app-gallery-open" aria-haspopup="dialog" aria-label={'Åbn billede: '+item.title} onClick={event=>{returnFocus.current=event.currentTarget;setIndex(i)}}><div className="app-gallery-excerpt"><img src={item.src} alt={item.alt} width={item.width} height={item.height} loading="lazy" decoding="async" style={captureStyle(item)}/><span className="app-gallery-expand" aria-hidden="true"><Expand size={17}/></span></div></button><figcaption><h3>{item.title}</h3><p>{item.description}</p></figcaption></figure>)}</div><p className="app-gallery-note">Billederne er endnu ikke opdateret til det nye design. Telefonens systemlinjer er skjult i billedvisningen.</p>{current&&typeof document!=='undefined'&&createPortal(<div className="app-gallery-overlay" ref={overlayRef} onClick={event=>{if(event.target===event.currentTarget)dismiss()}}><GalleryDialogContent item={current} index={index} total={SCREENSHOTS.length} onClose={dismiss} onStep={step} dialogRef={dialogRef} closeRef={closeRef} scrollRef={scrollRef} titleId={id+'-dialog'}/></div>,document.body)}</section>
}
