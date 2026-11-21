// One presentation vocabulary over the existing authoritative R3 state.
// This module never advances the engine or manufactures a restart/foul.
export const MATCH_PHASE=Object.freeze({
 KICK_OFF:'KICK_OFF',PLAYING:'PLAYING',GOAL_SCORED:'GOAL_SCORED',
 HALFTIME:'HALFTIME',FULL_TIME:'FULL_TIME',THROW_IN:'THROW_IN',
 CORNER:'CORNER',GOAL_KICK:'GOAL_KICK',FREE_KICK:'FREE_KICK',STOPPED:'STOPPED'
});
const restarts=Object.freeze({'throw-in':MATCH_PHASE.THROW_IN,corner:MATCH_PHASE.CORNER,'goal-kick':MATCH_PHASE.GOAL_KICK,'free-kick':MATCH_PHASE.FREE_KICK});
export function matchPhase(state){
 if(state.period==='finished')return MATCH_PHASE.FULL_TIME;
 if(state.period==='halftime'||state.intermissionRemaining>0)return MATCH_PHASE.HALFTIME;
 const stage=state.goalSequence?.stage;
 if(stage==='net'||stage==='celebration')return MATCH_PHASE.GOAL_SCORED;
 if(state.openingKickoff||stage==='kickoff'&&state.freeze>0)return MATCH_PHASE.KICK_OFF;
 if(state.restart&&state.freeze>0)return restarts[state.restart.kind]||MATCH_PHASE.STOPPED;
 return MATCH_PHASE.PLAYING;
}
