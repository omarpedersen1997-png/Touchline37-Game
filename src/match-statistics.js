// Match counters come from the shared replay engine. Missing measurements stay
// missing: a blank side is never filled with an invented opponent value.
const count=value=>typeof value==='number'&&Number.isFinite(value)?Math.min(1000000,Math.max(0,Math.floor(value))):null;
const present=value=>value!==null;

export function matchStatistics(raw){
 const stats=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const homePossession=count(stats.homePossession),awayPossession=count(stats.awayPossession);
 let possession={home:null,away:null};
 if(present(homePossession)&&present(awayPossession)&&homePossession+awayPossession>0){
  const home=Math.round(homePossession/(homePossession+awayPossession)*100);
  possession={home,away:100-home};
 }
 const rows=[
  {key:'shots',label:'Skud',home:count(stats.homeShots),away:count(stats.awayShots)},
  {key:'saves',label:'Redninger',home:count(stats.homeSaves),away:count(stats.awaySaves)},
  {key:'possession',label:'Boldbesiddelse',...possession,percent:true}
 ];
 const homeAttempts=count(stats.homePassAttempts),awayAttempts=count(stats.awayPassAttempts);
 const homeCompleted=count(stats.homeCompletedPasses),awayCompleted=count(stats.awayCompletedPasses);
 const homeTackles=count(stats.homeTackles),awayTackles=count(stats.awayTackles);
 const teamPasses=present(homeAttempts)&&present(awayAttempts);
 const teamCompletions=present(homeCompleted)&&present(awayCompleted);
 const teamTackles=present(homeTackles)&&present(awayTackles);
 if(teamPasses)rows.push({key:'passAttempts',label:'Afleveringsforsøg',home:homeAttempts,away:awayAttempts});
 if(teamCompletions)rows.push({key:'completedPasses',label:'Fuldførte afleveringer',home:present(homeAttempts)?Math.min(homeCompleted,homeAttempts):homeCompleted,away:present(awayAttempts)?Math.min(awayCompleted,awayAttempts):awayCompleted});
 if(teamTackles)rows.push({key:'tackles',label:'Vundne tacklinger',home:homeTackles,away:awayTackles});

 // Engines 1–7 expose these counters for the home club only. Do not present
 // them as totals for both teams or derive unrecorded away statistics.
 const homeOnly=[];
 const attempts=count(stats.passes),completed=count(stats.completedPasses),tackles=count(stats.tackles);
 if(!teamPasses&&present(attempts))homeOnly.push({key:'homePassAttempts',label:'Afleveringsforsøg',value:attempts});
 if(!teamCompletions&&present(completed))homeOnly.push({key:'homeCompletedPasses',label:'Fuldførte afleveringer',value:present(attempts)?Math.min(completed,attempts):completed});
 if(!teamTackles&&present(tackles))homeOnly.push({key:'homeTackles',label:'Vundne tacklinger',value:tackles});

 const personal=[
  ['goals','Mål','userGoals'],['assists','Oplæg','userAssists'],['saves','Redninger','userSaves'],
  ['passes','Fuldførte afleveringer','userPasses'],['tackles','Vundne tacklinger','userTackles']
 ].map(([key,label,field])=>({key,label,value:count(stats[field])})).filter(row=>present(row.value));
 return{available:rows.some(row=>present(row.home)||present(row.away))||homeOnly.length>0,rows,homeOnly,personal,hasPossession:possession.home!==null};
}

export function matchStatisticText(value,percent=false){
 return value===null?'—':percent?`${value} %`:String(value);
}
