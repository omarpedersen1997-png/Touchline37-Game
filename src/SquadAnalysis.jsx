import React from 'react';
import {teamStrengthDetails} from '../shared/team-strength.js';
import {formations} from '../worker/management.js';
import {tactics} from '../worker/progression.js';
export default function SquadAnalysis({state}){
 const roles=(formations[state.formation]||formations['4-3-3']).roles;
 const result=teamStrengthDetails({players:state.players,roles,trainingLevel:state.levels.training,coach:typeof state.staff?.coach==='object'?state.staff.coach.level:state.staff?.coach||0,clubBonus:state.expansion?.bonuses?.strengthBonus??(state.expansion?.dna==='ambition'?1:0)});
 const tactic=tactics[state.tactic]||tactics.balanced;
 return <section className="panel squad-analysis" aria-label="Sådan beregnes dit holds kampstyrke">
  <header><h2>Dit hold på banen</h2><b>{result.total}<small>/99</small></b></header>
  <dl><div><dt>Startellever</dt><dd>{result.average.toFixed(1).replace('.',',')}</dd></div><div><dt>Træner</dt><dd>+{result.coach}</dd></div><div><dt>Klubbonus</dt><dd>+{result.clubBonus}</dd></div></dl>
  <p>{result.outOfPosition?`${result.outOfPosition} spillere spiller uden for deres position. Det koster op til 6 styrkepoint pr. spiller.`:'Alle elleve spiller på deres naturlige position.'}</p>
  <p><strong>{tactic.name}.</strong> {tactic.description} Taktik og formation sendes med til kampen; de ændrer holdets spillestil.</p>
 </section>;
}
