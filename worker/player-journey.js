import {seeded} from './progression.js';

export const careerPlans = {
 balanced: {name:'Balanceret',description:'Fordel kræfterne mellem dit eget spil og holdets arbejde.',team:0,goals:1,assists:1,energy:18},
 linkup: {name:'Spil for holdet',description:'Skab chancer for andre. Færre egne afslutninger og et større energiforbrug.',team:.035,goals:.65,assists:1.6,energy:22},
 decisive: {name:'Tag initiativet',description:'Søg selv afgørelserne. Mere personligt ansvar, færre oplæg og større risiko.',team:-.025,goals:1.5,assists:.7,energy:26},
};
export const careerTerms = {
 development:{name:'Udviklingsspiller',salary:1,xp:1.1,training:20,energy:0,trust:0,average:0,matches:0,description:'Ekstra kamp-XP og billigere træning. Almindelig kamp­løn.'},
 starter:{name:'Fast starter',salary:1.15,xp:1,training:25,energy:2,trust:60,average:6.6,matches:10,description:'15% højere kampløn. Træneren forventer stabile præstationer.'},
 leader:{name:'Nøglespiller',salary:1.3,xp:1,training:25,energy:4,trust:80,average:7,matches:20,description:'30% højere kampløn. Mere ansvar og større belastning.'},
};
const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
export const averageForm=c=>{
 const matches=c.journey?.recentForm?c.journey.recentForm.map(performance=>({performance})):(c.history||[]).filter(x=>x.kind==='match').slice(0,10);
 return {matches:matches.length,average:matches.length?Math.round(matches.reduce((sum,x)=>sum+x.performance,0)/matches.length*10)/10:null};
};
const metric=(c,key)=>key==='training'?c.journey.trainingSessions:(c.stats[key]||0);
function goalsFor(c){
 const remaining=Math.max(1,10-c.season.played),scale=remaining/10;
 const role=c.position==='MÅL'?['saves','Trygge hænder',12]:c.position==='MID'?['assists','Gør holdkammeraterne bedre',3]:c.position==='FOR'?['cleanSheets','Hold modstanderen væk',3]:['goals','Sæt dit aftryk foran mål',4];
 return [['matches','Bliv en fast del af holdet',Math.min(5,remaining),100,50], [...role.slice(0,2),Math.max(1,Math.ceil(role[2]*scale)),150,75],['training','Arbejd mellem kampene',3,150,75]].map(([key,title,target,money,xp])=>({id:`season-${c.season.number}-${key}`,key,title,target,baseline:metric(c,key),money,xp,claimed:false}));
}
export function ensureJourney(c,now){
 c.journey||={version:1,enabled:false,fitness:100,coachTrust:50,plan:'balanced',trainingSessions:0,objectivesCompleted:0,lastRecovery:now,contract:null,seasonArchive:[]};
 const j=c.journey;
 j.recentForm??=(c.history||[]).filter(x=>x.kind==='match').slice(0,10).map(x=>x.performance);
 if(Number.isFinite(now)&&Number.isFinite(j.lastRecovery)&&now>j.lastRecovery){
  const points=Math.floor((now-j.lastRecovery)/120000);
  if(points){j.fitness=Math.min(100,j.fitness+points);j.lastRecovery+=points*120000;}
 }
 if(!j.objectives)j.objectives=goalsFor(c);
 return j;
}
export function enableJourney(c,now){
 const j=ensureJourney(c,now);if(j.enabled)return;
 j.enabled=true;j.lastRecovery=now;j.objectives=goalsFor(c);
}
export function objectiveProgress(c,goal){return Math.min(goal.target,Math.max(0,metric(c,goal.key)-goal.baseline));}
export function claimObjective(c,id){
 const goal=c.journey.objectives.find(item=>item.id===id);
 if(!goal||goal.claimed||objectiveProgress(c,goal)<goal.target)return null;
 goal.claimed=true;c.journey.objectivesCompleted++;c.journey.coachTrust=Math.min(100,c.journey.coachTrust+5);c.wallet+=goal.money;
 return {id:goal.id,title:goal.title,money:goal.money,xp:goal.xp};
}
export function closeJourneySeason(c,record){
 const rewards=[];
 for(const goal of c.journey.objectives){const reward=claimObjective(c,goal.id);if(reward)rewards.push(reward);}
 c.journey.seasonArchive.unshift({...record,rewards});c.journey.seasonArchive=c.journey.seasonArchive.slice(0,20);
 return rewards;
}
export function startJourneySeason(c){c.journey.objectives=goalsFor(c);}
export function termReason(c,key){
 const term=typeof key==='string'&&Object.hasOwn(careerTerms,key)?careerTerms[key]:null;if(!term)return 'Vælg en gyldig kontraktrolle.';
 const form=averageForm(c);
 if(c.stats.matches<term.matches)return `Kræver ${term.matches} karrierekampe.`;
 if(c.journey.coachTrust<term.trust)return `Kræver ${term.trust} i trænerens tillid.`;
 if(term.average&&(form.matches<5||form.average<term.average))return `Kræver mindst 5 nyere kampe og ${term.average.toFixed(1).replace('.',',')} i gennemsnitskarakter.`;
 return null;
}
export const currentTerm=c=>c.journey.contract?.clubId===c.clubId?careerTerms[c.journey.contract.role]:null;
export function journeyView(c){
 const j=c.journey,term=currentTerm(c);
 if(!j.enabled)j.objectives=goalsFor(c);
 return {enabled:j.enabled,fitness:j.fitness,coachTrust:j.coachTrust,form:averageForm(c),plan:j.plan,
  plans:Object.entries(careerPlans).map(([id,p])=>({id,name:c.position==='MÅL'?({balanced:'Balanceret målmand',linkup:'Spil sikkert ud',decisive:'Tag feltet'})[id]:p.name,description:c.position==='MÅL'?({balanced:'Afvej dine indgreb og hold en sikker udgangsposition.',linkup:'Prioritér holdets opbygning. Færre egne redningsaktioner, men bedre chancer for holdet.',decisive:'Søg flere indgreb og redningsaktioner. Større risiko for holdet og højere energiforbrug.'})[id]:p.description,energy:p.energy+(term?.energy||0)})),
  objectivesCompleted:j.objectivesCompleted,trainingSessions:j.trainingSessions,
  objectives:j.objectives.map(g=>({...g,progress:objectiveProgress(c,g),ready:!g.claimed&&objectiveProgress(c,g)>=g.target})),
  contract:term?{role:j.contract.role,name:term.name,description:term.description}:null,
  terms:Object.entries(careerTerms).map(([id,t])=>({id,name:t.name,description:t.description,salaryMultiplier:t.salary,eligible:!termReason(c,id),reason:termReason(c,id)})),
  rest:{duration:45000,recovery:35},seasonArchive:structuredClone(j.seasonArchive)};
}
export function matchTimeline(result,position,id){
 const random=seeded('personal-highlights:'+id),events=[];
 const minute=()=>1+Math.floor(random()*89);
 for(let i=0;i<result.home;i++)events.push({minute:minute(),side:'home',kind:'goal',personal:i<result.goals,assist:i>=result.goals&&i<result.goals+result.assists,text:i<result.goals?'Du sender bolden i nettet!':i<result.goals+result.assists?'Dit oplæg bliver til et mål!':'Dit hold scorer.'});
 for(let i=0;i<result.away;i++)events.push({minute:minute(),side:'away',kind:'goal',text:'Modstanderen scorer.'});
 if(position==='MÅL')for(let i=0;i<result.saves;i++)events.push({minute:minute(),side:'home',kind:'save',text:'Du holder afslutningen ude.'});
 events.push({minute:0,kind:'kickoff',text:'Kampen er i gang. Din kampplan er valgt.'});
 return events.sort((a,b)=>a.minute-b.minute);
}
export function liveCareerMatch(active,now){
 if(!active?.timeline)return null;
 const minute=limit(Math.floor((now-active.started)/(active.ends-active.started)*90),0,90);
 const events=active.timeline.filter(event=>event.minute<=minute);
 return {minute,home:events.filter(e=>e.kind==='goal'&&e.side==='home').length,away:events.filter(e=>e.kind==='goal'&&e.side==='away').length,events:structuredClone(events),plan:active.plan||'balanced'};
}
