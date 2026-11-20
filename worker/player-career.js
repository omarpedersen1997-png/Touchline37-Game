import{resolveRequestedMatchVersion}from'../shared/engine-versions.js';
import {createManualChallenge,playManualReplay,extendManualRecovery} from './manual.js';
import {ensureJourney,enableJourney,careerPlans,careerTerms,currentTerm,journeyView,claimObjective,closeJourneySeason,startJourneySeason,termReason,averageForm,matchTimeline,liveCareerMatch} from './player-journey.js';
import {GameError} from './management.js';
import {seeded} from './progression.js';

export const PLAYER_CAREER_MAX_LEVEL=50;
export const playerCareerRoles={ANG:'Angriber',MID:'Midtbane',FOR:'Forsvar',MÅL:'Målmand'};
export const playerCareerAttributes={technique:'Teknik',physical:'Fysik',reading:'Spilforståelse'};
export const playerCareerClubs=[
 {id:'havnebro',name:'Havnebro BK',division:0,divisionName:'Lokalfodbold',salary:150,fee:0,minLevel:1,minMatches:0},
 {id:'nordskov',name:'Nordskov Athletic',division:1,divisionName:'Regional elite',salary:300,fee:1600,minLevel:3,minMatches:8},
 {id:'solhavn',name:'Solhavn Union',division:2,divisionName:'National elite',salary:650,fee:6500,minLevel:8,minMatches:24},
 {id:'valora',name:'Valora Sporting',division:3,divisionName:'International elite',salary:1200,fee:18000,minLevel:16,minMatches:60},
 {id:'monteluce',name:'Monteluce AC',division:4,divisionName:'Kontinental elite',salary:1800,fee:40000,minLevel:24,minMatches:100,minObjectives:6,minTrust:65,minAverage:6.8},
 {id:'lysara',name:'Lysara FC',division:5,divisionName:'Verdensklasse',salary:2600,fee:85000,minLevel:35,minMatches:180,minObjectives:12,minTrust:80,minAverage:7,minTitles:4},
];
const TRAINING_DURATION=60000,MATCH_DURATION=45000,TRAINING_COST=25,TRAINING_XP=35,SEASON_TARGET=20;
const opponents=['Klintby IF','Østereng Rovers','Fjordholm FK','Bakkeport Union','Sundholm Athletic','Dalby Stjerner','Skovhavn 04','Havneby Fremad','Vestbro Bold','Engsø United'];
const supported=new Set(['player-career-create','player-career-train','player-career-allocate','player-career-match','player-career-transfer','player-career-plan','player-career-rest','player-career-claim-objective','player-career-manual-finish']);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const levelCost=level=>100+(level-1)*40;
const newSeason=number=>({number,played:0,points:0,wins:0,goals:0,assists:0,performanceTotal:0});
const clubFor=career=>playerCareerClubs.find(club=>club.id===career.clubId)||playerCareerClubs[0];
const reject=message=>{throw new GameError(message)};
const validateKey=key=>{if(typeof key!=='string'||!Object.hasOwn(playerCareerAttributes,key))reject('Vælg en gyldig træningsegenskab.')};

export function ensurePlayerCareer(s,now){
 if(s.playerCareer===undefined)s.playerCareer=null;
 const c=s.playerCareer;
 if(c){
  if(Number.isFinite(now))ensureJourney(c,now);
  c.masteryProgress||={technique:0,physical:0,reading:0};
  c.recentActions||=[];c.history||=[];c.contractHistory||=[];c.active??=null;
 }
 return s;
}
export function playerCareerRating(c){
 const weights={ANG:[.5,.25,.25],MID:[.4,.2,.4],FOR:[.2,.4,.4],MÅL:[.25,.2,.55]}[c.position]||[1/3,1/3,1/3];
 return clamp(Math.round(Object.keys(playerCareerAttributes).reduce((sum,key,i)=>sum+c.attributes[key]*weights[i],0)),1,99);
}
function awardXp(c,amount){
 if(c.level>=PLAYER_CAREER_MAX_LEVEL)return;
 c.xp+=amount;
 while(c.level<PLAYER_CAREER_MAX_LEVEL&&c.xp>=levelCost(c.level)){
  c.xp-=levelCost(c.level);c.level++;c.skillPoints+=2;
 }
 if(c.level===PLAYER_CAREER_MAX_LEVEL)c.xp=0;
}
function nextOpponent(c){
 const club=clubFor(c),draw=seeded(`player-career-opponent:${c.id}:${c.season.number}:${c.season.played}:${club.division}`);
 return{name:opponents[(c.season.played+club.division*3)%opponents.length],rating:Math.min(95,[46,60,73,85,91,95][club.division]+Math.floor(c.season.played*.6)+Math.floor(draw()*3))};
}
function transferOffer(c,club){
 let reason='Klar til at forhandle';
 if(c.active)reason='Afslut din aktive træning eller kamp først.';
 else if(c.level<club.minLevel)reason=`Kræver spillerniveau ${club.minLevel}.`;
 else if(c.stats.matches<club.minMatches)reason=`Kræver ${club.minMatches} karrierekampe.`;
 else if(c.season.played!==0)reason='Klubskifte åbner mellem dine sæsoner.';
 else if(club.minObjectives&&c.journey.objectivesCompleted<club.minObjectives)reason=`Kræver ${club.minObjectives} gennemførte personlige mål.`;
 else if(club.minTrust&&c.journey.coachTrust<club.minTrust)reason=`Kræver ${club.minTrust} i trænerens tillid.`;
 else if(club.minAverage&&(averageForm(c).matches<5||averageForm(c).average<club.minAverage))reason=`Kræver ${club.minAverage.toFixed(1).replace('.',',')} i form over mindst 5 nyere kampe.`;
 else if(club.minTitles&&c.stats.titles<club.minTitles)reason=`Kræver ${club.minTitles} vindersæsoner.`;
 else if(c.wallet<club.fee)reason=`Kræver ${club.fee.toLocaleString('da-DK')} kr. på din karrieresaldo.`;
 else return{...club,eligible:true,reason};
 return{...club,eligible:false,reason};
}
function simulateMatch(c,random){
 const opponent=nextOpponent(c),club=clubFor(c),rating=playerCareerRating(c);
 const plan=careerPlans[c.journey.plan],term=currentTerm(c);
 const chance=clamp(.5+([48,60,73,85,92,96][club.division]*.6+rating*.4-opponent.rating)/90+plan.team+(c.journey.enabled?(c.journey.fitness-70)/500:0),.18,.82);
 let home=0,away=0;
 for(let i=0;i<16;i++)if(random()<.19){if(random()<chance)home++;else away++}
 const goalChance=Math.min(.8,{ANG:.5,MID:.25,FOR:.08,MÅL:0}[c.position]*plan.goals),assistChance=Math.min(.8,{ANG:.2,MID:.45,FOR:.12,MÅL:0}[c.position]*plan.assists);
 let goals=0,assists=0;
 for(let i=0;i<home;i++){if(random()<goalChance)goals++;else if(random()<assistChance)assists++}
 const saves=c.position==='MÅL'?2+Math.floor(random()*6)+(c.journey.plan==='decisive'?2:c.journey.plan==='linkup'?-1:0):0,cleanSheet=away===0;
 const readiness=c.journey.enabled?(c.journey.fitness-70)/75:0;
 const fit=c.journey.enabled?(c.journey.plan==='linkup'?(c.attributes.reading-c.attributes.physical)/200:c.journey.plan==='decisive'?((c.position==='MÅL'?c.attributes.physical:c.attributes.technique)-c.attributes.reading)/200:0):0;
 const performance=Math.round(clamp(6+readiness+fit+(rating-opponent.rating)/40+(random()-.5)*2.4+goals*.4+assists*.3+(c.position==='MÅL'?saves*.08:0)+(cleanSheet?.2:0),3,10)*10)/10;
 return{opponent:opponent.name,opposition:opponent.rating,club:club.name,division:club.division,home,away,goals,assists,saves,cleanSheet,performance,salary:Math.round(club.salary*(term?.salary||1)),xp:Math.round((70+club.division*15+(home>away?20:home===away?10:0)+Math.floor(performance*2))*(term?.xp||1)),plan:c.journey.plan};
}
export function settlePlayerCareer(s,now){
 ensurePlayerCareer(s,now);const c=s.playerCareer,a=c?.active;
 if(!a||now<a.ends)return null;extendManualRecovery(a);
 if(a.manual&&!a.replayVerified){
  if(now<a.manual.expiresAt)return null;
  a.result={opponent:a.opponent,opposition:a.manual.config.awayRating,club:clubFor(c).name,division:clubFor(c).division,home:0,away:3,goals:0,assists:0,saves:0,cleanSheet:false,performance:3,salary:0,xp:0,plan:a.plan||'balanced',manual:true,forfeited:true};
 }
 c.active=null;
 let record;
 if(a.kind==='training'){
  c.journey.trainingSessions++;c.masteryProgress[a.focus]++;
  let attributeGain=0;
  if(c.masteryProgress[a.focus]>=3){c.masteryProgress[a.focus]=0;if(c.attributes[a.focus]<99){c.attributes[a.focus]++;attributeGain=1}}
  awardXp(c,TRAINING_XP);
  record={id:a.id,kind:'training',focus:a.focus,xp:TRAINING_XP,attributeGain,finished:a.ends};
 }else if(a.kind==='recovery'){
  const restored=Math.min(35,100-c.journey.fitness);c.journey.fitness+=restored;record={id:a.id,kind:'recovery',recovered:restored,finished:a.ends,xp:0};
 }else{
  const result=a.result;
  const pressure=c.journey.contract?.role==='leader'?6.5:c.journey.contract?.role==='starter'?6.2:5.5;
  c.journey.coachTrust=clamp(c.journey.coachTrust+(result.performance>=7?3:result.performance<pressure?-4:0),0,100);
  c.journey.recentForm.unshift(result.performance);c.journey.recentForm=c.journey.recentForm.slice(0,10);
  c.wallet+=result.salary;c.stats.matches++;
  c.stats[result.home>result.away?'wins':result.home===result.away?'draws':'losses']++;
  c.stats.goals+=result.goals;c.stats.assists+=result.assists;c.stats.saves+=result.saves;
  if(result.cleanSheet)c.stats.cleanSheets++;
  c.season.played++;c.season.points+=result.home>result.away?3:result.home===result.away?1:0;
  c.season.wins+=result.home>result.away?1:0;c.season.goals+=result.goals;c.season.assists+=result.assists;c.season.performanceTotal+=result.performance;
  awardXp(c,result.xp);
  record={id:a.id,kind:'match',...result,finished:a.ends};
  if(c.season.played===10){
   const title=c.season.points>=SEASON_TARGET,averageRating=Math.round(c.season.performanceTotal/10*10)/10,award=averageRating>=7.5;
   const bonus=(title?500:0)+(award?300:0);
   c.stats.titles+=title?1:0;c.stats.awards+=award?1:0;c.wallet+=bonus;
   awardXp(c,(title?150:0)+(award?100:0));
   record.seasonEnd={number:c.season.number,points:c.season.points,title,award,bonus,averageRating};
   const rewards=c.journey.enabled?closeJourneySeason(c,{...record.seasonEnd,club:clubFor(c).name}):[];
   record.seasonEnd.objectiveMoney=rewards.reduce((sum,r)=>sum+r.money,0);record.seasonEnd.objectiveXp=rewards.reduce((sum,r)=>sum+r.xp,0);
   for(const reward of rewards)awardXp(c,reward.xp);
   c.season=newSeason(c.season.number+1);startJourneySeason(c);
  }
 }
 c.history.unshift(record);c.history=c.history.slice(0,20);
 return record;
}
export function playerCareerAction(s,a,now,random=Math.random){
 if(!supported.has(a.type))return false;
 if(typeof a.id!=='string'||a.id.length<1||a.id.length>100)reject('Ugyldig karrierehandling.');
 ensurePlayerCareer(s,now);
 if(s.playerCareer?.recentActions.includes(a.id))return true;
 settlePlayerCareer(s,now);
 if(a.type==='player-career-create'){
  if(s.playerCareer)reject('Du har allerede oprettet din spillerkarriere.');
  if(typeof a.name!=='string'||a.name.trim().length<2||a.name.trim().length>24||/[\u0000-\u001f\u007f]/.test(a.name))reject('Spillernavnet skal være mellem 2 og 24 tegn.');
  if(typeof a.position!=='string'||!Object.hasOwn(playerCareerRoles,a.position))reject('Vælg en gyldig position.');
  const attributes={technique:40,physical:40,reading:40};attributes[{ANG:'technique',MID:'reading',FOR:'physical',MÅL:'reading'}[a.position]]=45;
  s.playerCareer={id:a.id,name:a.name.trim(),position:a.position,createdAt:now,attributes,masteryProgress:{technique:0,physical:0,reading:0},level:1,xp:0,skillPoints:2,wallet:100,clubId:'havnebro',season:newSeason(1),stats:{matches:0,wins:0,draws:0,losses:0,goals:0,assists:0,saves:0,cleanSheets:0,titles:0,awards:0},active:null,history:[],contractHistory:[],recentActions:[a.id]};
  ensureJourney(s.playerCareer,now);if(a.journeyVersion===1)enableJourney(s.playerCareer,now);return true;
 }
 const c=s.playerCareer;if(!c)reject('Opret din egen spiller først.');
 if(a.type==='player-career-manual-finish'){
  if(c.history.some(m=>m.id===a.matchId&&m.manual))return true;
  if(!c.active)reject('Din spillede spillerkamp er ikke længere aktiv.');
  const current=c.active,replay=playManualReplay(current,a,now),goals=replay.stats.userGoals,assists=replay.stats.userAssists,saves=replay.stats.userSaves,cleanSheet=replay.awayScore===0;
  const form=Math.round(clamp(5.5+goals*.65+assists*.45+Math.min(5,replay.stats.userTackles)*.18+Math.min(8,saves)*.16+Math.min(10,replay.stats.userPasses)*.05+(replay.homeScore>replay.awayScore?.2:0)+(cleanSheet&&(c.position==='MÅL'||c.position==='FOR')?.4:0)-replay.awayScore*.1,3,10)*10)/10;
  current.result={opponent:current.opponent,opposition:current.manual.config.awayRating,club:clubFor(c).name,division:clubFor(c).division,home:replay.homeScore,away:replay.awayScore,goals,assists,saves,cleanSheet,performance:form,salary:current.salary,xp:Math.round((70+clubFor(c).division*15+(replay.homeScore>replay.awayScore?20:replay.homeScore===replay.awayScore?10:0)+Math.floor(form*2))*(current.xpMultiplier||1)),plan:current.plan,manual:true,manualStats:replay.stats};
  current.replayVerified=true;settlePlayerCareer(s,now);c.recentActions=[...c.recentActions.slice(-49),a.id];return true;
 }
 if(a.journeyVersion===1||a.control==='manual'||['player-career-plan','player-career-rest','player-career-claim-objective'].includes(a.type)||typeof a.contract==='string')enableJourney(c,now);
 if(c.active)reject('Afslut din aktive karrieretræning eller kamp først.');
 if(a.type==='player-career-train'){
  validateKey(a.key);
  if(c.attributes[a.key]>=99)reject('Denne egenskab har nået sit maksimum.');
  const cost=currentTerm(c)?.training||TRAINING_COST;
  if(c.wallet<cost)reject('Du har ikke penge nok på karrieresaldoen.');
  if(c.journey.enabled&&c.journey.fitness<15)reject('Tag et restitutionspas først. Din spiller er for træt til træning.');
  if(c.journey.enabled)c.journey.fitness-=8;c.wallet-=cost;c.active={id:a.id,kind:'training',focus:a.key,started:now,ends:now+TRAINING_DURATION};
 }else if(a.type==='player-career-allocate'){
  validateKey(a.key);
  if(c.skillPoints<1)reject('Du har ingen frie færdighedspoint.');
  if(c.attributes[a.key]>=99)reject('Denne egenskab har nået sit maksimum.');
  c.skillPoints--;c.attributes[a.key]++;
 }else if(a.type==='player-career-match'){
  if(a.control==='manual'&&s.active?.manual)reject('Afslut klubbens spillede kamp først.');
  if(c.journey.enabled&&c.journey.fitness<25)reject('Din energi skal være mindst 25 før en kamp. Restituér først.');
  const plan=careerPlans[c.journey.plan],fitness=c.journey.fitness;
  const result=a.control==='manual'?null:simulateMatch(c,random);
  if(c.journey.enabled)c.journey.fitness=Math.max(0,c.journey.fitness-plan.energy-(currentTerm(c)?.energy||0));
  if(a.control==='manual'){
   const next=nextOpponent(c),manual=createManualChallenge({homeRating:[48,60,73,85,92,96][clubFor(c).division],awayRating:next.rating,personalPosition:c.position,personalRating:playerCareerRating(c),technique:c.attributes.technique,physical:c.attributes.physical,reading:c.attributes.reading,fitness,...(resolveRequestedMatchVersion(a.manualVersion)?{matchVersion:resolveRequestedMatchVersion(a.manualVersion),...(resolveRequestedMatchVersion(a.manualVersion)===11&&a.engineRevision!==undefined?{engineRevision:a.engineRevision}:{}),stadiumStage:Math.min(3,clubFor(c).division)}: {})},now);
   c.active={id:a.id,kind:'match',started:now,ends:now+manual.duration,opponent:next.name,manual,plan:c.journey.plan,salary:Math.round(clubFor(c).salary*(currentTerm(c)?.salary||1)),xpMultiplier:currentTerm(c)?.xp||1};
  }else c.active={id:a.id,kind:'match',started:now,ends:now+MATCH_DURATION,opponent:result.opponent,result,plan:c.journey.plan,timeline:matchTimeline(result,c.position,a.id)};
 }else if(a.type==='player-career-transfer'){
  const club=playerCareerClubs.find(entry=>entry.id===a.club);
  if(!club||club.id===c.clubId)reject('Denne klubkontrakt er ikke tilgængelig.');
  if(club.division<=clubFor(c).division)reject('Vælg en ny udfordring på et højere niveau.');
  const offer=transferOffer(c,club);if(!offer.eligible)reject(offer.reason);
  const contract=a.contract||'development';if(typeof contract!=='string'||!Object.hasOwn(careerTerms,contract))reject('Vælg en gyldig kontraktrolle.');
  const blocked=termReason(c,contract);if(blocked)reject(blocked);
  c.journey.contract=c.journey.enabled?{clubId:club.id,role:contract}:null;
  c.wallet-=club.fee;c.contractHistory.unshift({id:club.id,name:club.name,division:club.division,startedAt:now});c.contractHistory=c.contractHistory.slice(0,10);c.clubId=club.id;
 }else if(a.type==='player-career-plan'){
  if(typeof a.key!=='string'||!Object.hasOwn(careerPlans,a.key))reject('Vælg en gyldig kampplan.');c.journey.plan=a.key;
 }else if(a.type==='player-career-rest'){
  if(c.journey.fitness>=100)reject('Din spiller har allerede fuld energi.');
  c.active={id:a.id,kind:'recovery',started:now,ends:now+45000};
 }else if(a.type==='player-career-claim-objective'){
  const reward=claimObjective(c,a.key);if(!reward)reject('Målet er ikke klar, er hentet eller hører til en tidligere sæson.');awardXp(c,reward.xp);
 }
 c.recentActions=[...c.recentActions.slice(-49),a.id];
 return true;
}
export function playerCareerView(s,now){
 if(!s.playerCareer)return null;const c=structuredClone(s.playerCareer);ensureJourney(c,now);
 const active=c.active?{id:c.active.id,kind:c.active.kind,started:c.active.started,ends:c.active.ends,...(c.active.kind==='training'?{focus:c.active.focus}:c.active.kind==='match'?{opponent:c.active.opponent,live:liveCareerMatch(c.active,now),...(c.active.manual?{manual:structuredClone(c.active.manual)}:{})}:{})}:null;
 return{journey:journeyView(c),name:c.name,position:c.position,roleLabel:playerCareerRoles[c.position],attributes:{...c.attributes},masteryProgress:{...c.masteryProgress},rating:playerCareerRating(c),level:c.level,maxLevel:PLAYER_CAREER_MAX_LEVEL,xp:c.xp,nextLevelXp:c.level>=PLAYER_CAREER_MAX_LEVEL?0:levelCost(c.level),skillPoints:c.skillPoints,wallet:c.wallet,club:{...clubFor(c),salary:Math.round(clubFor(c).salary*(currentTerm(c)?.salary||1))},stats:{...c.stats},season:{...c.season,targetPoints:SEASON_TARGET},active,
  offers:playerCareerClubs.filter(club=>club.division>clubFor(c).division).map(club=>transferOffer(c,club)),
  trainingOptions:Object.entries(playerCareerAttributes).map(([key,label])=>({key,label,description:'Tre gennemførte pas i samme egenskab giver +1, op til 99.',cost:currentTerm(c)?.training||TRAINING_COST,duration:TRAINING_DURATION,xp:TRAINING_XP})),
  nextOpponent:nextOpponent(c),matchDuration:MATCH_DURATION,history:structuredClone(c.history),contractHistory:structuredClone(c.contractHistory)};
}
