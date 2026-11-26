import {createMatch, PHASE, HALF_TICKS} from './engine.js';

export const SCENARIOS = Object.freeze([
  {id:'comeback', title:'Jagten på et point', description:'Havneby har bragt sig foran. Find en udligning, før tiden løber ud.',
    minute:72, goals:0, conceded:1, seed:7, target:'Uafgjort eller sejr', result:delta=>delta>=0},
  {id:'lead', title:'Hold føringen', description:'Havneby har reduceret. Styr de sidste minutter og behold alle tre point.',
    minute:78, goals:2, conceded:1, seed:91, target:'Behold sejren', result:delta=>delta>0},
]);

export function scenarioMatch(scenario){
  const state=createMatch({id:'situation-'+scenario.id,seed:scenario.seed});
  // Both snapshots are immediately after an away goal. Reflect the regular
  // kickoff layout for the second half and leave the ball on the centre spot.
  state.half=2;
  state.tick=scenario.minute*HALF_TICKS/45;
  state.phase=PHASE.KICKOFF_READY;
  state.kickReason='goal';
  state.teams[0].stats.goals=scenario.goals;
  state.teams[1].stats.goals=scenario.conceded;
  for(const team of state.teams){
    team.direction*=-1;
    for(const p of team.players){
      p.x*=-1;p.fx*=-1;
      p.energy=65+(p.number*7%21);
    }
  }
  return state;
}

export function scenarioResult(scenario,state){
  if(state.phase!==PHASE.FULL_TIME)return null;
  return scenario.result(state.teams[0].stats.goals-state.teams[1].stats.goals);
}
