import React from'react';
import{BRAND_MARK}from'../shared/brand-mark.js';

export function TouchlineMark({size=44,className='',label,style}){
 return <svg className={'touchline-mark'+(className?' '+className:'')} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 64 64" role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} focusable="false" style={{display:'block',flexShrink:0,...style}}><rect x="1" y="1" width="62" height="62" rx="15" fill={BRAND_MARK.background} stroke={BRAND_MARK.border} strokeWidth="1.5"/><path d={BRAND_MARK.t} fill={BRAND_MARK.accent}/><path d={BRAND_MARK.line} fill="none" stroke={BRAND_MARK.accent} strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/></svg>;
}

export function TouchlineWordmark({size=44,subtitle='FOOTBALL IDLE',className=''}){
 return <span className={'touchline-wordmark'+(className?' '+className:'')} style={{display:'inline-flex',alignItems:'center',gap:12}}><TouchlineMark size={size}/><span style={{display:'block',fontWeight:750,fontSize:27,letterSpacing:'-1px',lineHeight:1.1,color:'#eef4e8'}}>touchline{subtitle&&<small style={{display:'block',fontWeight:550,fontSize:8,letterSpacing:'2.2px',lineHeight:1.5,color:'#a8bcb9',marginTop:5}}>{subtitle}</small>}</span></span>;
}
