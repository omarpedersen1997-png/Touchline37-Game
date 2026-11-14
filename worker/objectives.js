import{wonMatch}from'./management.js';
const day=now=>new Date(now).toISOString().slice(0,10);
export function dailyFor(s,now){return s.daily?.day===day(now)?s.daily:{day:day(now),matches:0,wins:0,claimed:[]}}
export function recordDailyMatch(s,match){s.firstWin||=wonMatch(match)||s.history.some(wonMatch);s.daily=dailyFor(s,match.ends);s.daily.matches++;if(wonMatch(match))s.daily.wins++}
export function missionsFor(s,now=Date.now()){
 const regular=[
  {id:'name',title:'Sæt dit navn på klubben',description:'Vælg et klubnavn, som fansene kan samles om.',reward:200,ready:!!s.named,target:'name'},
  {id:'upgrade',title:'Byg fundamentet',description:'Køb din første klubopgradering.',reward:300,ready:Object.values(s.levels).some(n=>n>1),target:'upgrades'},
  {id:'match',title:'Ud på grønsværen',description:'Gennemfør din første kamp.',reward:250,ready:s.history.length>0,target:'league'},
  {id:'signing',title:'En ny mand i trøjen',description:'Hent en spiller på transfermarkedet.',reward:400,ready:s.bought.length>0,target:'transfers'},
  {id:'win',title:'Den første sejr',description:'Vind en kamp med dit hold.',reward:600,ready:!!s.firstWin||s.history.some(wonMatch)||s.wins>0,target:'league'},
  {id:'promotion',title:'Et niveau højere',description:'Ryk op fra Serie 4.',reward:1500,ready:s.tier>0,target:'league'}
 ,...[
  ['academy-first','Egen avl. Ægte stolthed.','Uddan dit første talent på ungdomsakademiet.',700,s.career?.graduates||0,1,'upgrades'],
  ['staff-first','Et stærkt team bag holdet','Ansæt din første medarbejder.',350,Object.values(s.staff||{}).reduce((a,b)=>a+b,0),1,'upgrades'],
  ['fans-500','En by bag klubben','Nå 500 fans i klubben.',500,s.supporters||0,500,'club'],
  ['fans-2000','Tribunerne kalder','Nå 2.000 fans i klubben.',1200,s.supporters||0,2000,'club'],
  ['career-ten','Manager med erfaring','Gennemfør ti kampe i din karriere.',800,s.career?.matches||0,10,'league'],
  ['career-fifty','En klub med historie','Gennemfør 50 kampe i din karriere.',2000,s.career?.matches||0,50,'league'],
  ['cup-first','Sølvtøj i klubhuset','Vind din første pokaltitel.',1500,s.career?.cupsWon||0,1,'league']
 ].map(([id,title,description,reward,current,total,target])=>({id,title,description,reward,ready:current>=total,progress:Math.min(total,current),total,target}))
 ].map(m=>({...m,claimed:!!s.claimedMissions?.includes(m.id),kind:'milestone'}));
 const daily=dailyFor(s,now);
 return [...regular,{id:'daily-matches',title:'Dagens kampprogram',description:'Spil tre kampe i dag (UTC).',reward:400,ready:daily.matches>=3,claimed:daily.claimed.includes('daily-matches'),progress:Math.min(3,daily.matches),total:3,target:'league',kind:'daily'},{id:'daily-win',title:'Dagens sejr',description:'Vind en kamp i dag (UTC).',reward:300,ready:daily.wins>=1,claimed:daily.claimed.includes('daily-win'),progress:Math.min(1,daily.wins),total:1,target:'league',kind:'daily'}];
}
export function claimMission(s,id,now){const mission=missionsFor(s,now).find(m=>m.id===id);if(!mission||!mission.ready||mission.claimed)throw Error('Missionens belønning er ikke tilgængelig.');if(mission.kind==='daily'){s.daily=dailyFor(s,now);s.daily.claimed.push(id)}else{s.claimedMissions||=[];s.claimedMissions.push(id)}s.money+=mission.reward}
