import React,{useEffect,useId,useRef,useState}from'react';
import{RotateCw,ArrowUpRight}from'lucide-react';
import{TouchlineMark}from'./TouchlineBrand.jsx';
import{documentLink}from'./api.js';
import{publisher}from'./publisher.js';

export function appIsPortrait(view=globalThis.window){
 if(!view)return false;
 // On touch devices the keyboard changes the viewport's aspect ratio. The
 // physical screen orientation must keep a portrait handset behind the gate.
 const touch=view.matchMedia?.('(pointer: coarse)').matches||view.navigator?.maxTouchPoints>0,type=view.screen?.orientation?.type;
 if(touch&&/^portrait-/.test(type||''))return true;
 return view.innerWidth>0&&view.innerHeight>0?view.innerHeight>view.innerWidth:!!view.matchMedia?.('(orientation: portrait)').matches;
}

// Keep a live App mounted, but release held controls and prevent its global
// shortcuts from firing while the portrait cover is active. Keeping this
// cleanup symmetrical also handles rotations during a pending match save.
export function guardPortraitApp({view=window,doc=document,gate,heading}){
 const previous=doc.activeElement,overflow=doc.body.style.overflow;
 previous?.blur?.();doc.body.style.overflow='hidden';heading?.focus();
 view.dispatchEvent(new Event('blur'));
 const keyboard=event=>{
  event.stopImmediatePropagation();
  if(event.type==='keydown'&&event.key!=='Tab'&&!(event.key==='Enter'&&gate?.contains(event.target)&&event.target?.closest?.('a')))event.preventDefault();
 };
 const focus=event=>{if(!gate?.contains(event.target))heading?.focus();};
 view.addEventListener('keydown',keyboard,true);view.addEventListener('keyup',keyboard,true);doc.addEventListener('focusin',focus,true);
 return()=>{
  view.removeEventListener('keydown',keyboard,true);view.removeEventListener('keyup',keyboard,true);doc.removeEventListener('focusin',focus,true);doc.body.style.overflow=overflow;
  if(previous?.isConnected)previous.focus?.();
 };
}

export default function AppOrientationGate({children}){
 const[portrait,setPortrait]=useState(()=>appIsPortrait()),gate=useRef(null),heading=useRef(null),id=useId();
 useEffect(()=>{
  const refresh=()=>setPortrait(appIsPortrait()),media=window.matchMedia?.('(orientation: portrait)'),screenOrientation=window.screen?.orientation;
  window.addEventListener('resize',refresh);window.addEventListener('orientationchange',refresh);screenOrientation?.addEventListener?.('change',refresh);
  if(media?.addEventListener)media.addEventListener('change',refresh);else media?.addListener?.(refresh);refresh();
  return()=>{window.removeEventListener('resize',refresh);window.removeEventListener('orientationchange',refresh);screenOrientation?.removeEventListener?.('change',refresh);if(media?.removeEventListener)media.removeEventListener('change',refresh);else media?.removeListener?.(refresh);};
 },[]);
 useEffect(()=>{
  if(!portrait)return;
  return guardPortraitApp({gate:gate.current,heading:heading.current});
 },[portrait]);
 return <div className="touchline-app-viewport" data-orientation={portrait?'portrait':'landscape'}><div className="app-orientation-content" hidden={portrait} inert={portrait?true:undefined} aria-hidden={portrait?true:undefined}>{children}</div><section className="app-orientation-screen" hidden={!portrait} role="dialog" aria-modal={portrait?true:undefined} aria-labelledby={id+'-title'} aria-describedby={id+'-description'} ref={gate}><div className="app-orientation-card"><TouchlineMark size={48}/><span className="eyebrow">TOUCHLINE · BRED FORMAT</span><div className="app-rotate-device" aria-hidden="true"><span/><RotateCw size={30}/></div><h1 id={id+'-title'} ref={heading} tabIndex={-1}>Vend skærmen på langs.</h1><p id={id+'-description'}>Hele Touchline spilles i bredformat. Drej telefonen eller tabletten, så fortsætter du i klubhuset.</p><a href={documentLink(publisher.contactPath)}>Hjælp & support<ArrowUpRight size={17}/></a></div></section></div>;
}
