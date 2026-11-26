import React from'react';
import{BRAND_MARK}from'../shared/brand-mark.js';

export function TouchlineMark({size=44,className='',label,style}){
 const{cx,cy,r,width}=BRAND_MARK.ring;
 return <svg className={'touchline-mark'+(className?' '+className:'')} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 64 64" role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} focusable="false" style={{display:'block',flexShrink:0,...style}}><rect width="64" height="64" rx="13" fill={BRAND_MARK.background}/><circle cx={cx} cy={cy} r={r} fill="none" stroke={BRAND_MARK.accent} strokeWidth={width}/><path d={BRAND_MARK.gap} fill={BRAND_MARK.background}/><path d={BRAND_MARK.t} fill={BRAND_MARK.accent}/></svg>;
}

export function TouchlineWordmark({size=44,subtitle='Football Idle',className=''}){
 return <span className={'touchline-wordmark'+(className?' '+className:'')} style={{display:'inline-flex',alignItems:'center',gap:12}}><TouchlineMark size={size}/><span className="touchline-wordmark-text">Touchline{subtitle&&<small>{subtitle}</small>}</span></span>;
}
