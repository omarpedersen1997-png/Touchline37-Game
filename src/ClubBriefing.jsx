import React from 'react';
import {moneyLabel} from './format-money.js';
export function clubDecisions(state){
 const decisions=[];
 const ready=(state.missions||[]).filter(m=>m.ready&&!m.claimed).length;
 if(ready)decisions.push({id:'goals',title:`${ready} ${ready===1?'belønning er klar':'belønninger er klar'}`,text:'Hent de mål, du allerede har opfyldt.',to:'goals'});
 if(state.competition?.license?.ready===false)decisions.push({id:'licence',title:'Gør klublicensen klar',text:'Point er ikke nok alene. Se de manglende faciliteter.',to:'upgrades'});
 if(state.europe?.canEnter||state.europe?.pendingEntry)decisions.push({id:'europe',title:'Din Europaplads venter',text:'Se kvalifikation og næste trin i Aurora Europa Cup.',to:'europe'});
 const career=state.playerCareer;
 if(career?.active)decisions.push({id:'career',title:'Følg din spillerkarriere',text:career.active.kind==='recovery'?'Restitutionen er i gang.':'Se aktiviteten og din spillers næste skridt.',to:'player-career'});
 else if(career)decisions.push({id:'career',title:'Vælg dit træningsfokus',text:'Træning, kamp og restitution udvikler din egen spiller.',to:'player-career'});
 if(decisions.length<3)decisions.push({id:'team',title:'Gør holdet kampklart',text:`${state.formation||'4-3-3'} · ${state.strength??'—'} i holdstyrke. Se positioner, reserver og taktik.`,to:'team'});
 return decisions.slice(0,3);
}
export default function ClubBriefing({state,offline,onNavigate,onDismiss}){
 const decisions=clubDecisions(state),valid=offline&&Number.isFinite(offline.earned)&&offline.earned>=0&&offline.seconds>=60;
 return <details className="club-briefing"><summary><span>Din klubbriefing</span><small>{valid?`${moneyLabel(offline.earned)} passivt optjent`:decisions[0]?.title}</small></summary><div>{valid&&<section className="club-idle-summary" aria-label="Bekræftet passiv indtjening"><div><b>Velkommen tilbage.</b><p>{moneyLabel(offline.earned)} er allerede tilføjet af serveren for {Math.floor(offline.seconds/60)} minutter.</p><small>Op til otte timers passiv managerindtjening. Ingen ekstra udbetaling ved genåbning.</small></div><button type="button" onClick={onDismiss}>Forstået</button></section>}<nav aria-label="Dine næste klubbeslutninger">{decisions.map(item=><button type="button" key={item.id} onClick={()=>onNavigate(item.to)}><b>{item.title}</b><span>{item.text}</span></button>)}</nav></div></details>;
}
