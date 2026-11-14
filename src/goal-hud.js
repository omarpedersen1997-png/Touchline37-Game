// Compact presentation data; match inputs and authoritative scoring stay in the engine.
export function goalInputLocked(state){
 return state?.version>=10&&!!state.goalSequence&&state.period!=='finished'&&state.period!=='halftime';
}
export function goalHudState(state){
 if(!goalInputLocked(state))return null;
 const goal=state.goalSequence;
 if(!['net','celebration','kickoff'].includes(goal.stage))return null;
 const event=state.events?.findLast(event=>event.kind==='goal');
 return {stage:goal.stage,team:goal.team,kickoffTeam:goal.kickoffTeam,scorer:Number.isInteger(goal.scorer)?goal.scorer+1:null,assister:Number.isInteger(goal.assister)&&goal.assister!==goal.scorer?goal.assister+1:null,minute:event?.minute,ownGoal:!!event?.ownGoal,seconds:Math.max(1,Math.ceil(goal.remainingTicks*.05)),cut:goal.stage==='kickoff'&&goal.stageTicks<6};
}
