import{prepareClubManual,playManualReplay,manualForfeit,extendManualRecovery}from'./manual.js';
import{resolveRequestedMatchVersion}from'../shared/engine-versions.js';
import{ensurePlayerCareer,settlePlayerCareer,playerCareerAction,playerCareerView}from'./player-career.js';
import{ensureEurope,qualifyEurope,europeAction,europeView,validateEuropeMatch,settleEurope}from'./europe.js';
import{ensureCompetition,licenceFor,oppositionFor,competitionView,trainingLicenceUpgrade}from'./competition.js';
import{clubStyle,styleAction}from'./clubstyle.js';
import{expansionAction,expansionView}from'./expansion.js';
import{ensureManagement,economyFor,selectedStrength,managementAction,managementView,gateFor,formations,recordSupport,GameError}from'./management.js';
import {ensureCareer,recordCareerMatch} from './career.js';
import {missionsFor,claimMission,recordDailyMatch} from './objectives.js';
import {seeded,tactics,effectiveRating,seasonalMarket,leagueFor} from './progression.js';
export {tactics,effectiveRating} from './progression.js';
export const upgrades = {
 stadium:{name:'Stadion',base:600,growth:1.6},
 training:{name:'Træningsanlæg',base:650,growth:1.48},
 sponsor:{name:'Sponsorater',base:350,growth:1.65}
};
export const initialPlayers=[
 ['Oliver Holm','MÅL',48,1],['Emil Lund','FOR',45,2],['Noah Berg','FOR',47,4],['Lucas Dahl','FOR',44,5],['Oscar Bak','FOR',46,3],['William Storm','MID',49,6],['Elias Møller','MID',46,8],['Alfred Vang','MID',48,10],['Malthe Frost','ANG',50,7],['Theo Lind','ANG',52,9],['Viktor Sø','ANG',47,11]
].map(([name,position,rating,number],i)=>({id:'p'+i,name,position,rating,number}));
export const market=[
 {id:'m1',name:'Felix Nord',position:'ANG',rating:64,number:19,price:950,age:21},
 {id:'m2',name:'Anton Falk',position:'MID',rating:61,number:18,price:750,age:23},
 {id:'m3',name:'Mikkel Skov',position:'FOR',rating:60,number:22,price:650,age:24},
 {id:'m4',name:'Adam Winther',position:'MÅL',rating:62,number:12,price:800,age:22},
 {id:'m5',name:'Isak Strand',position:'ANG',rating:76,number:14,price:3400,age:20},
 {id:'m6',name:'August Birk',position:'MID',rating:73,number:16,price:2800,age:25}
];
export const opponents=['Havneby IF','Skovlund BK','Østerdal FC','Vestkysten','Søby United','Nordby IF','Dalens BK','Fjordby FC','Enghaven','Bakkeby IK'];
export const leagues=['Serie 4','Serie 3','Serie 2','Serie 1','Danmarksserien','3. Division','2. Division','1. Division','Superligaen'];
export function createGame(now=Date.now()){return ensurePlayerCareer(ensureEurope(ensureManagement({name:'Nordhavn FC',founded:now,named:false,money:1500,levels:{stadium:1,training:1,sponsor:1},players:structuredClone(initialPlayers),bought:[],season:1,tier:0,tactic:'balanced',seasonResults:[],played:0,points:0,wins:0,draws:0,goals:0,history:[],active:null,last:now,actions:[],version:0})));}
export const rate=s=>economyFor(s).net;
export const strength=s=>selectedStrength(s);
export const saleValue=p=>p.academy?0:Math.max(40,Math.floor((p.price??Math.max(0,p.rating-30)*14)*.45)+(Math.floor((p.trainingInvestment||0)*.2)));
export const stadiumFor=s=>{const level=s.levels.stadium,stage=level>=10?3:level>=6?2:level>=3?1:0;return{level,stage,name:['Lokalbanen','Klubstadion','Byens stadion','Den store arena'][stage],capacity:500+Math.round(Math.pow(level-1,1.4)*450),nextStageAt:[3,6,10,null][stage]}};
export const marketFor=s=>[...market,...seasonalMarket(s)];
export function matchReward(s,home,away){return (home>away?400:home===away?220:140)*(1+s.tier*.45);}

export const price=(s,key)=>Math.round(upgrades[key].base*Math.pow(upgrades[key].growth,s.levels[key]-1));
export function accrue(s,now){ensureEurope(ensureManagement(s));const elapsed=Math.min(28800000,Math.max(0,now-s.last));const earned=elapsed/1000*rate(s);s.money+=earned;s.last=now;return {earned,seconds:Math.floor(elapsed/1000)};}
export function settle(s,now){
 settlePlayerCareer(s,now);ensureEurope(ensureManagement(s));if(!s.active||now<s.active.ends)return null;const m=s.active;extendManualRecovery(m);
 if(m.manual&&!m.replayVerified){if(now<m.manual.expiresAt)return null;manualForfeit(m);}
 if(m.competition==='europe')settleEurope(s,m,now);
 recordCareerMatch(s,m,now);s.expansion.points++;recordDailyMatch(s,m);recordSupport(s,m);s.money+=m.reward;s.history.unshift({...m,finished:now});s.history=s.history.slice(0,20);s.active=null;
 if(m.competition==='europe')return s.history[0];
 if(m.competition==='cup'){
  s.cup.history.push({round:s.cup.round,opponent:m.opponent,home:m.home,away:m.away,won:m.cupWon,penalties:m.penalties||null});
  if(m.cupWon){s.cup.round++;if(s.cup.round===3){s.cup.champion=true;ensureCareer(s,now).cupsWon=(s.career.cupsWon||0)+1;s.history[0].cupChampion=true}}else s.cup.eliminated=true;
  return s.history[0];
 }
 s.points+=m.home>m.away?3:m.home===m.away?1:0;s.wins+=m.home>m.away?1:0;s.draws+=m.home===m.away?1:0;s.goals+=m.home;s.seasonResults||=[];s.seasonResults.push({round:s.played,home:m.home,away:m.away});s.played++;
 if(s.played===10){
  const rules=s.competitionRules,table=leagueFor(s,opponents).table,rank=table.findIndex(t=>t.self)+1,license=licenceFor(s);
  const qualified=s.points>=rules.targetPoints,promoted=qualified&&s.tier<8&&license.ready,champion=s.tier===8&&rules.version===2&&qualified&&rank===1;
  const licenseBlocked=qualified&&s.tier<8&&!license.ready,titleReward=champion?5000:0;
  s.history[0].seasonEnd={points:s.points,promoted,table,rank,champion,requiredPoints:rules.targetPoints,licenseBlocked,titleReward};
  s.seasonArchive.unshift({season:s.season,tier:s.tier,league:leagues[s.tier],points:s.points,rank,promoted,champion,licenseBlocked,requiredPoints:rules.targetPoints,rulesVersion:rules.version});s.seasonArchive=s.seasonArchive.slice(0,20);s.history[0].seasonEnd.europeQualified=qualifyEurope(s,s.seasonArchive[0]);
  if(champion){ensureCareer(s,now).topFlightTitles++;s.money+=titleReward}
  if(promoted){ensureCareer(s,now).promotions++;s.tier++;s.money+=2000*(s.tier+1);s.supporters+=100;s.reputation=Math.min(100,s.reputation+5)}
  s.season++;s.seasonResults=[];s.played=0;s.points=0;s.wins=0;s.draws=0;s.goals=0;ensureManagement(s)
 }return s.history[0];
}
export function apply(s,action,now=Date.now(),random=Math.random){
 ensureEurope(ensureManagement(s));
 if(!action||typeof action.id!=='string'||action.id.length>100)throw Error('Ugyldig handling.');
 if(action.type==='manual-match-finish'){const prior=s.history.find(m=>m.id===action.matchId&&m.manual);if(prior)return{manualResult:prior};}
 if(s.actions.includes(action.id))return;
 let manualResult=null;
 if(action.type==='manual-match-finish'){
  const m=s.active,replay=playManualReplay(m,action,now);
  m.home=replay.homeScore;m.away=replay.awayScore;m.events=replay.events;m.manualStats=replay.stats;m.replayVerified=true;
  const cup=m.competition==='cup',europe=m.competition==='europe',knockout=cup||(europe&&m.europeStage!=='group');
  const chance=Math.max(.2,Math.min(.8,.5+(m.manual.config.homeRating-m.opposition)/65));
  const penaltyRandom=seeded('manual-penalties:'+m.manual.seed);
  const won=m.home>m.away||(m.home===m.away&&penaltyRandom()<chance);
  if(cup)m.cupWon=won;if(europe&&knockout)m.europeWon=won;
  if(knockout&&m.home===m.away)m.penalties={home:won?5:4,away:won?4:5};
  m.reward=Math.round((europe?(knockout?(won?1200:500):m.home>m.away?1000:m.home===m.away?600:400):matchReward(s,m.home,m.away))+(m.gate?.net||0)+(cup?(won?[250,500,1200][m.cupRound]:100):0));
  manualResult=settle(s,now);
 }else if(action.type==='rename'){if(typeof action.name!=='string'||action.name.trim().length<2||action.name.trim().length>24)throw Error('Klubnavnet skal være mellem 2 og 24 tegn.');s.name=action.name.trim();s.named=true;}
 else if(action.type==='claim'){claimMission(s,action.key,now);}
 else if(europeAction(s,action)){}
 else if(playerCareerAction(s,action,now,random)){}
 else if(expansionAction(s,action,now)){}
 else if(styleAction(s,action)){}
 else if(managementAction(s,action,now)){}
 else if(action.type==='tactic'){if(s.active)throw Error('Vent, til kampen er færdig.');if(!Object.hasOwn(tactics,action.key))throw Error('Ukendt taktik.');s.tactic=action.key;}
 else if(action.type==='upgrade'){if(s.active&&action.key==='training')throw Error('Vent, til kampen er færdig.');if(!Object.hasOwn(upgrades,action.key))throw Error('Ukendt opgradering.');if(action.key==='training'&&!trainingLicenceUpgrade(s)&&[...s.players,...s.reserves].every(p=>effectiveRating(p,s.levels.training+1)===effectiveRating(p,s.levels.training)))throw Error('Din trup har allerede maksimal styrke.');const cost=price(s,action.key);if(s.money<cost)throw Error('Du har ikke penge nok endnu.');s.money-=cost;s.levels[action.key]++;}
 else if(action.type==='buy'){if(s.active)throw Error('Vent, til kampen er færdig.');const p=marketFor(s).find(p=>p.id===action.player);if(!p||s.bought.includes(p.id))throw Error('Spilleren er ikke tilgængelig.');if(s.money<p.price)throw Error('Du har ikke penge nok endnu.');if(s.reserves.length>=7)throw new GameError('Reservebænken er fuld. Sælg en reservespiller først.');const choices=s.players.map((v,i)=>({...v,index:i})).filter(v=>v.position===p.position).sort((a,b)=>a.rating-b.rating);if(!choices.length){const i=p.position==='MÅL'?0:s.players.findIndex(v=>v.position!=='MÅL');choices.push({...s.players[i],index:i})}if(choices[0].rating>=p.rating)throw Error('Din trup er allerede stærkere på den position.');s.money-=p.price;const signing={...p};const occupied=new Set([...s.players,...s.reserves].map(v=>v.number));if(occupied.has(signing.number))signing.number=Array.from({length:99},(_,i)=>i+1).find(n=>!occupied.has(n));s.reserves.push(s.players[choices[0].index]);s.players[choices[0].index]=signing;s.bought.push(p.id);ensureCareer(s,now).signings++;}
 else if(action.type==='sell'){
  if(s.active)throw Error('Vent, til kampen er færdig.');
  const index=s.players.findIndex(p=>p.id===action.player),reserve=s.reserves.findIndex(p=>p.id===action.player);if(index<0&&reserve<0)throw Error('Spilleren er ikke i din trup.');
  const player=index>=0?s.players[index]:s.reserves[reserve],value=saleValue(player);if(!value)throw Error('Akademispilleren kan ikke sælges.');
  if(index>=0)s.players[index]={id:'academy-'+crypto.randomUUID(),name:'Akademitalent',position:player.position,rating:35,number:player.number,academy:true,potential:80,development:0};else s.reserves.splice(reserve,1);
  s.money+=value;const career=ensureCareer(s,now);career.sales=(career.sales||0)+1;career.transferIncome=(career.transferIncome||0)+value;
 }
 else if(action.type==='match'||action.type==='cup-match'||action.type==='europe-match'){
  if(s.active)throw Error('Der spilles allerede en kamp.');
  if(action.control==='manual'&&s.playerCareer?.active?.manual)throw new GameError('Afslut din spillede spillerkamp først.');
  const cup=action.type==='cup-match',europe=action.type==='europe-match',europePlan=europe?validateEuropeMatch(s):null;if(cup&&(s.played<2||s.cup.eliminated||s.cup.champion))throw new GameError('Pokalkampen er ikke tilgængelig. Spil mindst to ligakampe i sæsonen.');
  const opponent=europe?europePlan.opponent:cup?['Sundby Pokalhold','Ådalens Elite','Kronborg FK'][s.cup.round]:opponents[s.played],opposition=europe?europePlan.opposition:oppositionFor(s,{cup,round:cup?s.cup.round:s.played});
  const formation=formations[s.formation]||formations['4-3-3'];
  const tactic=tactics[s.tactic]||tactics.balanced;
  const chance=Math.max(.2,Math.min(.8,.5+(strength(s)-opposition)/65));
  const events=[];let home=0,away=0;
  for(let minute=6;minute<=84;minute+=6){
   const side=random()<chance?'home':'away';
   const attacking=side==='home'?tactic.attack*formation.attack:tactic.defense*formation.defense;
   const goal=random()<.145*attacking;
   if(goal){if(side==='home')home++;else away++;const scorer=side==='home'?(()=>{const pool=s.players.filter(p=>p.position==='ANG'||p.position==='MID');const scorers=pool.length?pool:s.players.slice(1);return scorers[Math.floor(random()*scorers.length)].name})():opponent;events.push({minute,side,kind:'goal',scorer,text:side==='home'?`${scorer} sender bolden i nettet!`:`${opponent} finder en åbning og scorer.`});}
   else if(random()<.4){const texts=side==='home'?['En hurtig kombination åbner modstanderens forsvar.','Afslutning fra kanten af feltet — keeperen redder!','Holdet presser højt og vinder bolden tilbage.']:['Forsvaret rydder op foran eget mål.','Modstanderen truer på en omstilling.','En vigtig redning holder holdet inde i kampen.'];events.push({minute,side,kind:'chance',text:texts[Math.floor(random()*texts.length)]});}
  }
  const gate=gateFor(s),knockout=cup||(europe&&europePlan.stage!=='group'),won=knockout?(home>away||(home===away&&random()<chance)):undefined,cupWon=cup?won:undefined,europeWon=europe&&knockout?won:undefined,penalties=knockout&&home===away?{home:won?5:4,away:won?4:5}:undefined;
  s.active={competition:europe?'europe':cup?'cup':'league',formation:s.formation,gate,...(cup?{cupWon,penalties,cupRound:s.cup.round}:{}),...(europe?{europeWon,penalties,europeStage:europePlan.stage,europeCampaignId:s.europe.campaign.id}:{}),id:action.id,opponent,opposition,tactic:s.tactic||'balanced',started:now,ends:now+36000,home,away,events,reward:Math.round((europe?(knockout?(europeWon?1200:500):home>away?1000:home===away?600:400):matchReward(s,home,away))+gate.net+(cup?(cupWon?[250,500,1200][s.cup.round]:100):0))};
  if(action.control==='manual')prepareClubManual(s.active,{homeRating:strength(s),awayRating:opposition,tactic:s.tactic||'balanced',...(resolveRequestedMatchVersion(action.manualVersion)?{matchVersion:resolveRequestedMatchVersion(action.manualVersion),formation:s.formation,stadiumStage:stadiumFor(s).stage}: {})},now);
 }
 else throw Error('Ukendt handling.');
 s.actions=[...s.actions.slice(-49),action.id];
 if(manualResult)return{manualResult};
}
export function publicState(s,now){s=ensureEurope(ensureManagement(structuredClone(s)));const copy=structuredClone(s);copy.players=copy.players.map(p=>({...p,saleValue:saleValue(p)}));copy.tactic||='balanced';delete copy.actions;if(copy.active){const elapsed=Math.max(0,Math.min(90,Math.floor((now-copy.active.started)/(copy.active.ends-copy.active.started)*90)));copy.active.events=copy.active.events.filter(e=>e.minute<=elapsed);copy.active.home=copy.active.events.filter(e=>e.side==='home'&&(!e.kind||e.kind==='goal')).length;copy.active.away=copy.active.events.filter(e=>e.side==='away'&&(!e.kind||e.kind==='goal')).length;delete copy.active.reward;delete copy.active.cupWon;delete copy.active.europeWon;delete copy.active.penalties;}const management=managementView(s,now),league=leagueFor(s,opponents);management.reserves=management.reserves.map(p=>({...p,saleValue:saleValue(p)}));return {...copy,...management,playerCareer:playerCareerView(s,now),expansion:expansionView(s,now),clubStyle:clubStyle(s),europe:europeView(s),trainingLicenseUpgrade:trainingLicenceUpgrade(s),competition:competitionView(s,league.table.findIndex(t=>t.self)+1),seasonArchive:s.seasonArchive,stadium:stadiumFor(s),career:s.career||null,missions:missionsFor(s,now),market:marketFor(s),league,winReward:Math.round(matchReward(s,1,0)),serverTime:now,rate:rate(s),strength:strength(s),prices:Object.fromEntries(Object.keys(upgrades).map(k=>[k,price(s,k)]))};}
