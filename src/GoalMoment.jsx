import React from'react';
export default function GoalMoment({goal,home,away,club,opponent}){
 if(!goal)return null;
 if(goal.stage==='kickoff')return <><div className="match-kickoff-cut" data-visible={goal.cut} aria-hidden="true"/><div className="match-kickoff-status" role="status"><span>Klar til kickoff</span><b>{goal.seconds}</b><small>{goal.kickoffTeam==='home'?club:opponent} giver bolden op</small></div></>;
 return <div className="manual-goal match-goal-detail" role="status" data-stage={goal.stage}><span>{goal.team==='home'?'MÅL!':'Mål til modstanderen'}</span><b>{home} – {away}</b><small>{goal.team==='home'?club:opponent}{goal.minute?` · ${goal.minute}′`:''}</small>{goal.ownGoal&&<p>Selvmål</p>}{goal.scorer!==null&&!goal.ownGoal&&<p>Nr. {goal.scorer}{goal.assister!==null&&<em> · Assist: nr. {goal.assister}</em>}</p>}</div>;
}
