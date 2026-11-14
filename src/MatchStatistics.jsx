import React from 'react';
import {matchStatistics,matchStatisticText} from './match-statistics.js';
import './match-statistics.css';

export default function MatchStatistics({stats,club='Dit hold',opponent='Modstanderen',personal=false,title='Kampstatistik'}){
 const data=matchStatistics(stats);
 return <section className="match-statistics" aria-label={title}>
  <h4>{title}</h4>
  {!data.available?<p className="match-statistics-empty">Der er ingen registrerede holdtal for denne kamp.</p>:<>
   <table>
    <caption className="match-statistics-caption">Registrerede hændelser for {club} og {opponent}</caption>
    <thead><tr><th scope="col" title={club}>{club}</th><th scope="col">Statistik</th><th scope="col" title={opponent}>{opponent}</th></tr></thead>
    <tbody>{data.rows.map(row=><tr key={row.key}><td>{matchStatisticText(row.home,row.percent)}</td><th scope="row">{row.label}</th><td>{matchStatisticText(row.away,row.percent)}</td></tr>)}</tbody>
   </table>
   {!data.hasPossession&&<p className="match-statistics-note">Boldbesiddelse vises, når den er registreret.</p>}
   {data.homeOnly.length>0&&<div className="match-statistics-home"><h5>{club} · registrerede handlinger</h5><dl>{data.homeOnly.map(row=><div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p className="match-statistics-note">Modstanderens tal for disse handlinger er ikke registreret.</p></div>}
  </>}
  {personal&&data.personal.length>0&&<details className="match-statistics-personal"><summary>Din indsats</summary><dl>{data.personal.map(row=><div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>}
 </section>;
}
