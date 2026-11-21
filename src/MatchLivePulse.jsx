import React from 'react';
import {matchStatistics} from './match-statistics.js';
export default function MatchLivePulse({stats,events=[],catchingUp=false}){
 const data=matchStatistics(stats),shots=data.rows.find(row=>row.key==='shots'),possession=data.rows.find(row=>row.key==='possession');
 return <aside className="match-live-pulse" aria-label="Kampens udvikling">
  <div className="match-live-numbers"><span>Skud <b>{shots?.home??'—'} · {shots?.away??'—'}</b></span>{data.hasPossession&&<span>Boldbesiddelse <b>{possession.home} %</b></span>}</div>
  {data.hasPossession&&<div className="match-possession-track" aria-label={`${possession.home} procent boldbesiddelse til dit hold`}><i style={{width:possession.home+'%'}}/></div>}
  {catchingUp?<p role="status">Genoptager kampen…</p>:events.length>0?<details className="match-live-events"><summary><span role="status">{events[0].minute}′ · {events[0].text}</span></summary><ol>{events.map(event=><li key={event.id} data-kind={event.kind}><time>{event.minute}′</time>{event.text}</li>)}</ol></details>:<p>Find pladsen. Skab næste chance.</p>}
 </aside>;
}
