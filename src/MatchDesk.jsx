import React from'react';
import{ClubBadge}from'./ClubStudio.jsx';
import MatchModeChoices from'./MatchModeChoices.jsx';
import{leagues,opponents}from'../worker/game.js';
const number=value=>Math.round(Number.isFinite(value)?value:0).toLocaleString('da-DK');

export default function MatchDesk({state:s,now,rank,busy,onPlay,onSimulate}){
 const active=s.active,opponent=active?.opponent||opponents[s.played]||'Næste modstander';
 const minute=active?Math.min(90,Math.max(0,Math.floor((now-active.started)/Math.max(1,active.ends-active.started)*90))):0;
 const competition=active?.competition==='cup'?'Sæsonpokalen':active?.competition==='europe'?'Aurora Europa Cup':leagues[s.tier];
 return <div className="matchday-desk">
  <section className="matchday-main" aria-labelledby="matchday-title">
   <header className="matchday-caption"><h2 id="matchday-title">{active?'Kamp i gang':'Næste kamp'}</h2><span>{competition} · {active?minute+'′':'Sæson '+s.season}</span></header>
   <div className="matchday-fixture console-fixture"><div><ClubBadge style={s.clubStyle} name={s.name} size={54}/><b>{s.name}</b><small>Hjemme</small></div><strong aria-label={active&&!active.manual?'Aktuel stilling':'Mod'}>{active&&!active.manual?`${active.home} : ${active.away}`:'VS'}</strong><div><ClubBadge style={{color:s.clubStyle?.color==='blue'?'orange':'blue',crest:'round'}} name={opponent} size={54}/><b>{opponent}</b><small>Ude</small></div></div>
   <p className="matchday-line">{s.formation} <span>·</span> {Math.max(0,10-s.played)} ligakampe tilbage</p>
   <div className="matchday-actions">{active?<button className="primary" type="button" disabled={busy} onClick={onPlay}>{active.manual?'Fortsæt kamp':'Se live'}</button>:<MatchModeChoices label="Vælg kampform til ligakampen" onManual={onPlay} onSimulate={onSimulate} disabled={busy} manualDisabled={!!s.playerCareer?.active?.manual} manualHint="Din spillerkarrierekamp er stadig i gang. Du kan simulere klubkampen imens."/>}</div>
  </section>
  <dl className="matchday-figures" aria-label="Klubbens nøgletal">{[['Holdstyrke',number(s.strength)],['Fans',number(s.supporters)],['Ligaplads',rank+'.']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 </div>;
}
