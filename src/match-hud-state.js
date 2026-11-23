import {matchPhase} from './match-flow.js';
import {analyseMatch} from './match-analysis.js';
import {goalHudState} from './goal-hud.js';

// One snapshot for initial reveal and routine HUD updates: a prepared field
// must never appear with the previous/default score, player or kickoff state.
export function snapshotMatchHud(session,{duration,kickoff=0,catchingUp=false,players=[],feed}={}){
 const state=session.state,player=state.home[state.controlled]||state.home[0];
 const referee=state.engineRevision>=4?state.refereeEvents.findLast(event=>['yellow-card','red-card','advantage','substitution'].includes(event.kind)&&state.tick-event.tick<58):null;
 return{
  flow:state.version===11&&state.engineRevision>=3?matchPhase(state):null,
  setup:!!state.openingKickoff&&state.freeze>0,catchingUp,
  analysis:session.complete||state.intermissionRemaining>0?analyseMatch(state,players):null,
  events:feed?.observe(state)||[],kickoff,home:state.homeScore,away:state.awayScore,
  goalMoment:goalHudState(state),stats:{...state.stats},tactic:state.tactic,formation:state.formation,
  seconds:Math.max(0,duration-session.count*session.inputMs/1000),energy:player.energy,
  charge:Math.max(state.shotCharge||0,state.passCharge||0)/18,half:state.half||1,pause:state.intermissionRemaining||0,
  skillCooldown:state.skillCooldown||0,chargeKind:state.passCharge>0?'Løftet aflevering':'Skudkraft',
  restart:state.restart&&(state.engineRevision>=4?!state.restart.released:state.tick-state.restart.tick<22)?state.restart.kind:null,controlled:state.controlled,
  ...(state.engineRevision>=4?{shirt:player.shirt,substitutions:state.substitutions,referee,restartTeam:state.restart?.team}:{}),
  radar:['home','away'].flatMap(team=>state[team].flatMap((p,i)=>p.sentOff?[]:[{x:p.x,y:p.y,team,active:team==='home'&&i===state.controlled}])),
  ball:{x:state.ball.x,y:state.ball.y},possession:state.ball.owner?.team,
  owns:state.ball.owner?.team==='home'&&state.ball.owner.index===state.controlled
 };
}
