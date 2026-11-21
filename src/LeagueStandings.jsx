import React from 'react';
import {Shield} from 'lucide-react';
import {leagues} from '../worker/game.js';

const scheduleNote = 'Alle hold mødes én gang. Hver klub spiller 10 kampe og har én frirunde. Rivalernes kampe afvikles sammen med dine.';

export function LeagueStandings({state, teams}) {
 return <section className="panel league-panel league-standings" aria-label="Ligatabel">
  <div className="panel-head">
   <div><span className="eyebrow">SÆSON {state.season}</span><h2>{leagues[state.tier]}</h2></div>
   <span className="level">{state.played} / 10 KAMPE</span>
  </div>
  <div className="table-scroll" tabIndex={0} role="region" aria-label="Rul i ligatabellen">
   <table>
    <caption className="workspace-sr-only">{leagues[state.tier]} · Sæson {state.season}. {scheduleNote}</caption>
    <thead><tr><th scope="col">#</th><th scope="col">KLUB</th><th scope="col">K</th><th scope="col">+/−</th><th scope="col">POINT</th></tr></thead>
    <tbody>{teams.map((team,index)=><tr className={team.self?'your-team':''} key={team.name+String(team.self)}>
     <td>{index+1}</td><td><Shield size={16}/>{team.name}{team.self&&<span>DIG</span>}</td><td>{team.played}</td>
     <td>{team.goalsFor-team.goalsAgainst>0?'+':''}{team.goalsFor-team.goalsAgainst}</td><td>{team.points}</td>
    </tr>)}</tbody>
   </table>
  </div>
 </section>;
}

export function LeagueRoundResults({fixtures=[]}) {
 return <section className="panel league-round-results" aria-label="Ligaens seneste runde">
  <div className="panel-head"><h2>Seneste runde</h2></div>
  <p className="table-note">{scheduleNote}</p>
  {fixtures.length?<div className="round-results">{fixtures.map((fixture,index)=><div className={`fixture-row ${fixture.self?'self':''}`} key={index}>
   <span>{fixture.homeTeam}</span><b>{fixture.home}–{fixture.away}</b><span>{fixture.awayTeam}</span>
  </div>)}</div>:<p className="table-note">Spil den første ligakamp for at se rundens resultater.</p>}
 </section>;
}
