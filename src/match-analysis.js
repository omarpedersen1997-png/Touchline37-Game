import {matchStatistics} from './match-statistics.js';
const count=n=>Number.isFinite(n)?Math.max(0,n):0;
// Advice uses observed counters, never invented xG, injuries or player ratings.
export function analyseMatch(state={},roster=[]){
 const stats=state.stats||{},view=matchStatistics(stats),shots=view.rows.find(r=>r.key==='shots'),possession=view.rows.find(r=>r.key==='possession');
 const attempts=stats.homePassAttempts??stats.passes,completed=stats.homeCompletedPasses??stats.completedPasses;
 const accuracy=Number.isFinite(attempts)&&attempts>0&&Number.isFinite(completed)?Math.round(Math.min(1,completed/attempts)*100):null;
 const advice=[];
 if(accuracy!==null&&attempts>=5&&accuracy<65)advice.push('Spil kortere afleveringer, og vent på en fri medspiller.');
 if(count(shots?.away)>count(shots?.home)+2)advice.push('Modstanderen afslutter mere. Prøv en mere kompakt kampplan.');
 if(possession?.home!==null&&possession?.home<40)advice.push('Brug bredden og en fri støttepasning for at holde på bolden.');
 const tired=Array.isArray(state.home)?state.home.filter(p=>Number.isFinite(p.energy)&&p.energy<40).length:null;
 if(tired)advice.push(`${tired} ${tired===1?'spiller har':'spillere har'} lav kampenergi. Brug sprint mere selektivt.`);
 if(!advice.length)advice.push(count(shots?.home)===0?'Find et frit afslutningsrum, før du søger skuddet.':'Bevar balancen, og fortsæt med at skabe frie afslutninger.');
 const contributions=new Map();
 for(const event of state.events||[]){
  if(event.kind!=='goal'||!['home','away'].includes(event.side)||event.ownGoal)continue;
  for(const [index,key] of [[event.scorer,'goals'],[event.assister,'assists']]){
   if(!Number.isInteger(index)||index<0||index>=11)continue;
   const identity=event.side+':'+index,item=contributions.get(identity)||{index,side:event.side,goals:0,assists:0};item[key]++;contributions.set(identity,item);
  }
 }
 const best=[...contributions.values()].sort((a,b)=>(b.goals*3+b.assists*2)-(a.goals*3+a.assists*2)||a.index-b.index)[0];
 const star=best?{...best,name:best.side==='home'?(roster[best.index]?.name||`Spiller ${best.index+1}`):`Modstanderens spiller ${best.index+1}`} :null;
 return {accuracy,tired,advice:advice.slice(0,2),star,shots,possession};
}
