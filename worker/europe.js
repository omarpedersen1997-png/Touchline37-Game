import{GameError}from'./management.js';
import{seeded}from'./progression.js';
import{ensureCareer}from'./career.js';
export class EuropeError extends GameError{}
export const europeanCompetitionName='Aurora Europa Cup';
const clubs=[
 {name:'Monteluce AC',country:'Italien'},{name:'Rivemont FC',country:'Frankrig'},
 {name:'Kusthaven SV',country:'Nederlandene'},{name:'Oliva CF',country:'Spanien'},
 {name:'Bergvik SK',country:'Sverige'},{name:'Dunmere Athletic',country:'Storbritannien'},
 {name:'Vale Azul',country:'Portugal'},{name:'Hafenwald 04',country:'Tyskland'},
 {name:'Danubia Union',country:'Østrig'},{name:'Tatra Zelená',country:'Slovakiet'},
 {name:'Nordlys FK',country:'Norge'},{name:'Lakeshore Rovers',country:'Irland'}
];
const stages={quarter:{label:'Kvartfinale',opposition:96,index:0},semi:{label:'Semifinale',opposition:98,index:1},final:{label:'Finale',opposition:99,index:2}};
const complete=c=>c&&(c.status==='eliminated'||c.status==='champion');
export function ensureEurope(s){
 s.europe||={};const e=s.europe;e.pendingEntry??=null;e.campaign??=null;e.campaigns??=0;e.completedCampaigns??=0;e.lastQualifiedSeason??=0;e.history||=[];return s;
}
export function qualifyEurope(s,season){
 ensureEurope(s);const e=s.europe;
 if(season.tier!==8||season.rank>3||season.points<20||season.season<=e.lastQualifiedSeason)return false;
 e.lastQualifiedSeason=season.season;e.pendingEntry={clubSeason:season.season,points:season.points,rank:season.rank};return true;
}
export function europeanTable(s,c=s.europe?.campaign){
 if(!c)return[];
 const table=[{name:s.name,country:'Danmark'},...c.groupClubs].map((club,id)=>({id,...club,self:id===0,played:0,wins:0,draws:0,goalsFor:0,goalsAgainst:0,points:0}));
 for(const match of c.groupResults){const h=table[match.homeId],a=table[match.awayId];h.played++;a.played++;h.goalsFor+=match.home;h.goalsAgainst+=match.away;a.goalsFor+=match.away;a.goalsAgainst+=match.home;
  if(match.home>match.away){h.points+=3;h.wins++}else if(match.home<match.away){a.points+=3;a.wins++}else{h.points++;a.points++;h.draws++;a.draws++}
 }
 return table.sort((a,b)=>b.points-a.points||(b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst)||b.goalsFor-a.goalsFor||a.id-b.id);
}
export function europeNext(s){
 const c=s.europe?.campaign;if(!c||complete(c))return null;
 if(c.status==='group')return{stage:'group',label:`Gruppespil ${c.groupPlayed+1} / 3`,opponent:c.groupClubs[c.groupPlayed].name,country:c.groupClubs[c.groupPlayed].country,opposition:90+c.groupPlayed*2};
 const stage=stages[c.status],opponent=c.knockoutClubs[stage.index];return{stage:c.status,label:stage.label,opponent:opponent.name,country:opponent.country,opposition:stage.opposition};
}
export function europeAction(s,a){
 if(a.type!=='europe-enter')return false;ensureEurope(s);const e=s.europe;
 if(s.active)throw new EuropeError('Vent, til kampen er færdig.');
 if(e.campaign&&!complete(e.campaign))throw new EuropeError('Din europæiske kampagne er allerede i gang.');
 if(!e.pendingEntry)throw new EuropeError('Du mangler en kvalifikation fra Superligaen.');
 const id='europe-'+crypto.randomUUID(),random=seeded(id),pool=[...clubs];
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 e.campaigns++;e.campaign={id,entrySeason:e.pendingEntry.clubSeason,status:'group',groupClubs:pool.slice(0,3),knockoutClubs:pool.slice(3,6),groupPlayed:0,groupResults:[],knockoutRound:0,history:[]};e.pendingEntry=null;return true;
}
export function validateEuropeMatch(s){ensureEurope(s);const next=europeNext(s);if(!next)throw new EuropeError('Ingen europæisk kamp er tilgængelig. Kvalificér dig i Superligaen.');return next;}
export function settleEurope(s,m,now){
 const e=s.europe,c=e?.campaign,next=europeNext(s);
 if(!c||!next||m.europeCampaignId!==c.id||m.europeStage!==next.stage)throw new EuropeError('Den europæiske kamp matcher ikke din kampagne.');
 const won=m.europeStage==='group'?m.home>m.away:m.europeWon===true;
 c.history.push({id:m.id,stage:m.europeStage,label:next.label,opponent:m.opponent,home:m.home,away:m.away,won,penalties:m.penalties||null,finished:now});
 if(m.europeStage==='group'){
  const round=c.groupPlayed,other=[[2,3],[1,3],[1,2]][round],random=seeded(c.id+':group:'+round);
  c.groupResults.push({homeId:0,awayId:round+1,home:m.home,away:m.away},{homeId:other[0],awayId:other[1],home:Math.floor(random()*4),away:Math.floor(random()*4)});c.groupPlayed++;
  if(c.groupPlayed===3)c.status=europeanTable(s,c).findIndex(t=>t.self)<2?'quarter':'eliminated';
 }else if(!won)c.status='eliminated';
 else if(m.europeStage==='final'){
  c.status='champion';m.europeChampion=true;m.europeTrophyReward=10000;m.reward+=10000;ensureCareer(s,now).europeanTitles++;
 }else{c.knockoutRound++;c.status=m.europeStage==='quarter'?'semi':'final'}
 if(complete(c)){
  e.completedCampaigns++;e.history.unshift({id:c.id,entrySeason:c.entrySeason,finished:now,champion:c.status==='champion',stage:m.europeStage,groupRank:europeanTable(s,c).findIndex(t=>t.self)+1,matches:c.history.length});e.history=e.history.slice(0,20);
 }
}
export function europeView(s){
 ensureEurope(s);const e=s.europe,c=e.campaign,table=europeanTable(s,c);
 return{name:europeanCompetitionName,qualification:{requiredTier:8,minimumPoints:20,maximumRank:3,description:'Slut i Superligaens top 3 med mindst 20 point for at tjene en europæisk kampagne. Kvalifikation gives først, når sæsonen er gennemført.'},pendingEntry:e.pendingEntry,canEnter:!!e.pendingEntry&&!s.active&&(!c||complete(c)),canPlay:!!europeNext(s)&&!s.active,active:s.active?.competition==='europe',titles:s.career?.europeanTitles||0,completedCampaigns:e.completedCampaigns,history:e.history,
  campaign:c?{id:c.id,entrySeason:c.entrySeason,status:c.status,groupPlayed:c.groupPlayed,groupRank:table.findIndex(t=>t.self)+1,groupQualified:c.groupPlayed===3&&table.findIndex(t=>t.self)<2,
   groupFixtures:c.groupClubs.map((club,index)=>{const result=c.history.find(m=>m.stage==='group'&&m.opponent===club.name);return{index,opponent:club.name,country:club.country,opposition:90+index*2,played:!!result,...(result?{home:result.home,away:result.away}:{})}}),
   table,knockoutRound:c.knockoutRound,nextMatch:europeNext(s),history:c.history,champion:c.status==='champion',eliminated:c.status==='eliminated'}:null};
}
