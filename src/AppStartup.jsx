import React,{useEffect,useRef,useState} from 'react';
import {TouchlineMark} from './TouchlineBrand.jsx';
import {createStartupGate,startupSplashEnabled,saveStartupSplashPreference} from './startup-gate.js';
const local=()=>{try{return globalThis.localStorage;}catch{return undefined;}};
export default function AppStartup({children}){
 const [visible,setVisible]=useState(()=>startupSplashEnabled(local())),[exiting,setExiting]=useState(false),[quick,setQuick]=useState(false),[enabled,setEnabled]=useState(true),gate=useRef(null);
 useEffect(()=>{
  if(!visible)return;
  const controller=createStartupGate({onFade:({quick})=>{setQuick(quick);setExiting(true);},onDone:()=>setVisible(false),reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});gate.current=controller;
  const ready=()=>controller.ready();window.addEventListener('touchline:startup-ready',ready,{once:true});
  return()=>{controller.dispose();gate.current=null;window.removeEventListener('touchline:startup-ready',ready);};
 },[visible]);
 return <><div className="startup-app-content" inert={visible&&!exiting?true:undefined} aria-hidden={visible&&!exiting?true:undefined}>{children}</div>{visible&&<section className="startup-splash" data-exiting={exiting} style={{transitionDuration:quick?'80ms':undefined}} aria-label="Touchline starter" onClick={()=>gate.current?.skip()}>
  <div className="startup-brand"><TouchlineMark size={72}/><b>touchline</b><span>FOOTBALL IDLE</span><i aria-hidden="true"/></div>
  <div className="startup-options"><button type="button" onClick={()=>gate.current?.skip()}>Spring over</button><label onClick={event=>event.stopPropagation()}><input type="checkbox" checked={enabled} onChange={event=>{setEnabled(event.target.checked);saveStartupSplashPreference(event.target.checked,local());}}/>Vis ved opstart</label></div>
 </section>}</>;
}

export function StartupPreference(){
 const [enabled,setEnabled]=useState(()=>startupSplashEnabled(local()));
 return <label className="startup-preference"><input type="checkbox" checked={enabled} onChange={event=>{setEnabled(event.target.checked);saveStartupSplashPreference(event.target.checked,local());}}/><span>Vis startskærm ved opstart<small>Kan altid springes over med et tryk.</small></span></label>;
}
