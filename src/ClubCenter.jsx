import React,{useState}from'react';
import{Compass,Palette,ArrowUpRight}from'lucide-react';
import ExpansionCenter from'./ExpansionCenter.jsx';
import ClubStudio from'./ClubStudio.jsx';
export default function ClubCenter({state,now,busy,onAction,onNavigate}){
 const[page,setPage]=useState('strategy');
 return <div className="club-center modern-center"><section className="center-welcome panel"><span className="center-section-number" aria-hidden="true">01</span><div><span className="eyebrow">TOUCHLINE · KLUBUNIVERSET</span><h2>Byg en klub med karakter.</h2><p>Vælg din filosofi, udvikl nye fordele og skab en klub, der er din helt egen. Du bestemmer retningen.</p></div><span className="center-emblem" aria-hidden="true"><Compass size={42}/></span></section><div className="center-navigation" role="group" aria-label="Områder i klubcenteret"><button aria-pressed={page==='strategy'} onClick={()=>setPage('strategy')}><Compass size={18}/>Strategi & udvikling</button><button aria-pressed={page==='studio'} onClick={()=>setPage('studio')}><Palette size={18}/>Klubdesign</button></div><div hidden={page!=='strategy'}><ExpansionCenter state={state} now={now} busy={busy} onAction={onAction}/></div><div hidden={page!=='studio'}><ClubStudio state={state} busy={busy} onAction={onAction}/></div><button className="center-facilities quiet-button" onClick={()=>onNavigate('upgrades')}>Stadion, akademi & personale<ArrowUpRight size={17}/></button></div>
}
